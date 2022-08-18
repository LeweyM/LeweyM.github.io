---
title: Regex Processor 4 Testing, Fuzzing, and fixing things
draft: false
---
We can spend some time here doing some interesting things to our tests, which should make our lives a bit easier down the road.

### Testing against the Go regex package

As Go includes its own `regex` package, we can use this to validate our own implementation. Let's add a test which compares the results from our own FSM and the Go regex library.

```go
func TestFSMAgainstGoRegexPkg(t *testing.T) {  
   type test struct {  
      name  string  
      regex string  
      input string  
   }  
  
   tests := []test{  
      {"empty string", "abc", ""},  
      {"non matching string", "abc", "xxx"},  
      {"matching string", "abc", "abc"},  
      {"partial matching string", "abc", "ab"},  
   }  
  
   for _, tt := range tests {  
      t.Run(tt.name, func(t *testing.T) {  
         result := matchRegex(tt.regex, tt.input)  
  
         goRegexMatch := regexp.MustCompile(tt.regex).MatchString(tt.input)  
  
         if result != goRegexMatch {  
		   t.Fatalf(  
			  "Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'",  
			  regex,  
			  input,  
			  goRegexMatch,  
			  result)  
		   } 
      })  
   }  
}
```

Most of the testing logic is in the `matchRegex` function, so let's define that also.

```Go
func matchRegex(regex, input string) bool {  
   parser := NewParser()  
   tokens := lex(regex)  
   ast := parser.Parse(tokens)  
   startState, _ := ast.compile()  
   testRunner := NewRunner(startState)  
  
   for _, character := range input {  
      testRunner.Next(character)  
   }  
  
   return testRunner.GetStatus() == Success 
}
```

All we're doing here is setting up our lexer, parser, compiler and runner, then running through each character in the input. After running through the input string, we return the status.

Our tests should still be green. 

Let's compare the test structs between this and our previous tests.

```go
// old tests
type test struct {  
   name           string  
   input          string  
   expectedStatus Status  
}

// new tests
type test struct {  
  name  string  
  regex string  
  input string  
}  
```

Notice that we no longer require the `Status` field. This is because we no longer need to specify the result, as the Go library does that for us! 

Adding a new test case is pretty simple, we just need the inputs and the test is ready to go;

```diff
tests := []test{  
   {"empty string", "abc", ""},  
   {"non matching string", "abc", "xxx"},  
   {"matching string", "abc", "abc"},  
   {"partial matching string", "abc", "ab"},  
+  {"nested expressions", "a(b(d))c", "abdc"},  
}
```

Having a way of automatically computing the desired output for a test not only makes writing the tests less work, but also open up some interesting possibilities, such as Fuzzing.

### Fuzzing

Go 1.18 introduced [fuzzing](https://go.dev/doc/fuzz/) to its standard library, which is an automated way of barraging your code with semi-random input to try to find hidden errors.

Let's write a simple fuzz test.

```Go
func FuzzFSM(f *testing.F) {  
   f.Add("abc", "abc")  
   f.Add("abc", "")  
   f.Add("abc", "xxx")  
   f.Add("ca(t)(s)", "dog")  
  
   f.Fuzz(func(t *testing.T, regex, input string) {  
      compiledGoRegex, err := regexp.Compile(regex)  
      if err != nil {  
         t.Skip()  
      }  
  
      result := matchRegex(regex, input)  
      goRegexMatch := compiledGoRegex.MatchString(input)  
  
	  if result != goRegexMatch {  
	   t.Fatalf(  
		  "Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'",  
		  regex,  
		  input,  
		  goRegexMatch,  
		  result)  
	   }  
   })  
}
```

Let's step through this a bit. First, we need to add a few examples of input to our test function so that Go can seed the test corpus.

```Go
f.Add("abc", "abc")  
f.Add("abc", "")  
f.Add("abc", "xxx")  
f.Add("ca(t)(s)", "dog")  
```

Now for the test function;

```Go
f.Fuzz(func(t *testing.T, regex, input string) {  
      compiledGoRegex, err := regexp.Compile(regex)  
      if err != nil {  
         t.Skip()  
      }  
  
      result := matchRegex(regex, input)  
      goRegexMatch := compiledGoRegex.MatchString(input)  
  
      if result != goRegexMatch {  
		t.Fatalf(  
			"Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'",  
			regex,  
			input,  
			goRegexMatch,  
			result)  
	  } 
   })  
```

First, we only want to test valid regex statements, so any invalid statements we can simply ignore.

```Go
compiledGoRegex, err := regexp.Compile(regex)  
if err != nil {  
	t.Skip()  
}  
```

After that, we can simply test in the same way as in our previous test.

```Go
result := matchRegex(regex, input)  
goRegexMatch := compiledGoRegex.MatchString(input)  

if result != goRegexMatch {  
	t.Fatalf(  
		"Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'",  
		regex,  
		input,  
		goRegexMatch,  
		result)  
} 
```

Let's see what happens when we run this fuzz test. Use the following command line instruction;

```
go test ./src/v3/... -fuzz ^FuzzFSM$
```

Note: Your path might be different, use the path of the package with the test and FSM implementation.

We found an error!

### Let's get a'fixing

Note: Your mileage may vary. Go fuzzing uses randomized input, so there's no guarantee that errors will show up in the same order as I show here. 

```zsh
➜  search git:(master) ✗ go test ./src/v3/... -fuzz ^FuzzFSM$

fuzz: elapsed: 0s, gathering baseline coverage: 0/1110 completed
failure while testing seed corpus entry: FuzzFSM/08fa440d20a250cf53d6090f036f15915901b50eb6d2958bb4b00ce71de7ec7a
fuzz: elapsed: 0s, gathering baseline coverage: 3/1110 completed
--- FAIL: FuzzFSM (0.21s)
    --- FAIL: FuzzFSM (0.00s)
        v3_test.go:106: Mismatch - Regex: 'aA', Input: 'aaA' -> Go Regex Pkg: 'true', Our regex result: 'fail'

```

#### Problem 1

You should see that the fuzzer has saved this to a file at  `testdata/fuzz/FuzzFSM/08fa440d20a250cf53d6090f036f15915901b50eb6d2958bb4b00ce71de7ec7a`

```
go test fuzz v1  
string("aA")  
string("aaA")
```

It seems that passing `aaA` to the regex `aA` fails for our implementation, but passes for the Go implementation. This makes sense, because the Go regex package `MatchString` method we're using will look for a match anywhere in the string, whereas we're looking only at the beginning of the string.

Before we fix this, let's add a test for this case.

```diff
	{"non matching string", "abc", "xxx"},  
	{"matching string", "abc", "abc"},  
	{"partial matching string", "abc", "ab"},  
	{"nested expressions", "a(b(d))c", "abdc"},  
+	{"substring match with reset needed", "aA", "aaA"},
```

Now let's modify our test function to reset our FSM if there is a failure. That way, we will find matches at any point in the string, not just the beginning.

```diff
func matchRegex(regex, input string) Status {  
   parser := NewParser()  
   tokens := lex(regex)  
   ast := parser.Parse(tokens)  
   startState, _ := ast.compile()  
   testRunner := NewRunner(startState)  
  
   for _, character := range input {  
      testRunner.Next(character)  
+     status := testRunner.GetStatus()  
+	  if status == Fail {  
+	    testRunner.Reset()  
+		testRunner.Next(character)
+       continue  
+     }  
+  
+	  if status != Normal {  
+	     return status  
+	  }
   }  
  
   return testRunner.GetStatus()  
}
```

Notice that we need to run `testRunner.Next(character)` after the reset because the second `a` in the input string needs to be used in the second attempt. More on that later.

Let's run the fuzzer again.

#### Problem 2

```zsh
        v3_test.go:126: Mismatch - Regex: '', Input: 'A' -> Go Regex Pkg: 'true', Our regex result: 'false'
```

or in the file; 

```
go test fuzz v1  
string("")  
string("A")
```

This time the issue is when the regex is an empty string. In these cases, any input should match. Let's write a test case.

```diff
	{"empty string", "abc", ""},  
+	{"empty regex", "", "abc"},  
	{"non matching string", "abc", "xxx"},
```

And now we can solve this by adding a check in our `matchRegex` function;

```diff
func matchRegex(regex, input string) bool {  
   parser := NewParser()  
   tokens := lex(regex)  
   ast := parser.Parse(tokens)  
   startState, _ := ast.compile()  
   testRunner := NewRunner(startState)  
  
+   // for empty regex  
+   if testRunner.GetStatus() == Success {  
+      return true  
+   }
```

Tests are green so back to the fuzzer.

#### Problem 3

```zsh
        v3_test.go:105: Mismatch - Regex: '.', Input: '' -> Go Regex Pkg: 'false', Our regex result: 'success'
```

We're now failing when using the regex `.` and an input string. This makes sense because we haven't implemented the wildcard character `.` (yet). For now, let's ignore these special characters in our fuzz tests.

```diff
f.Fuzz(func(t *testing.T, regex, input string) {  
+     if strings.ContainsAny(regex, "[]{}$^|*+?.\\") {  
+        t.Skip()  
+     }  
  
      compiledGoRegex, err := regexp.Compile(regex)  
      if err != nil {  
         t.Skip()  
      }  
  
      result := matchRegex(regex, input)  
      goRegexMatch := compiledGoRegex.MatchString(input)  
  
      if result != goRegexMatch {  
	t.Fatalf(  
		"Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'",  
		regex,  
		input,  
		goRegexMatch,  
		result)  
}   
   })  
```

Rinse. Repeat

#### Problem 4

```zsh
v3_test.go:127: Mismatch - Regex: 'Ȥ', Input: 'Ȥ' -> Go Regex Pkg: 'true', Our regex result: 'false'
```

Now things are getting interesting. It seems that our regex matcher is having trouble with the non-alphanumeric character `Ȥ`. Let's start with a test and go from there.

```go
{"multibyte characters", "Ȥ", "Ȥ"},
```

I've called this test `multibyte characters` because these characters are represented as more than one byte. Let's change our error message to show this more clearly.

```diff
if result != goRegexMatch {  
-	t.Fatalf(  
-		"Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'",  
-		regex,  
-		input,  
-		goRegexMatch,
-	it’s 	result)  
+   t.Fatalf(  
+      "Mismatch - \nRegex: '%s' (as bytes: %x), \nInput: '%s' (as bytes: %x) \n-> \nGo Regex Pkg: '%t', \nOur regex result: '%v'",  
+      regex,  
+      []byte(regex),  
+      input,  
+      []byte(input),  
+      goRegexMatch,  
+      result)  
}
```

Running the fuzzer again we now get this;

```zsh
v3_test.go:94: Mismatch - 
	Regex: 'Ȥ'(as bytes: [200 164]), 
	Input: 'Ȥ'(as bytes: [200 164]) 
	-> 
	Go Regex Pkg: 'true', 
	Our regex result: 'false'
```

As we can see here, the character `Ȥ` is made up of the two bytes `[200 164]`





// completed

If we run the fuzzer now, we see something like this;

```zsh
➜  search git:(master) ✗ go test ./src/v3/... -fuzz ^FuzzFSM$

fuzz: elapsed: 0s, gathering baseline coverage: 0/1110 completed
fuzz: elapsed: 0s, gathering baseline coverage: 1110/1110 completed, now fuzzing with 8 workers
fuzz: elapsed: 3s, execs: 481830 (160569/sec), new interesting: 0 (total: 1110)
fuzz: elapsed: 6s, execs: 1041643 (186630/sec), new interesting: 0 (total: 1110)
fuzz: elapsed: 9s, execs: 1540600 (166326/sec), new interesting: 1 (total: 1111)
fuzz: elapsed: 12s, execs: 1997730 (152333/sec), new interesting: 1 (total: 1111)
fuzz: elapsed: 15s, execs: 2593993 (198784/sec), new interesting: 2 (total: 1112)
fuzz: elapsed: 18s, execs: 3120415 (175505/sec), new interesting: 2 (total: 1112)
fuzz: elapsed: 21s, execs: 3654537 (178003/sec), new interesting: 2 (total: 1112)
```

Fuzzing won't give us a green light like tests will. Fuzzing is an [infinite space problem](https://www.synopsys.com/blogs/software-security/fuzzing-test-cases-not-all-random/#:~:text=Fuzzing%20is%20an%20infinite%20space%20problem.%20For%20any%20piece%20of%20software%2C%20you%20can%20create%20an%20infinite%20number%20of%20malformed%20inputs.%20To%20get%20useful%20results%20in%20a%20reasonable%20amount%20of%20time%2C%20the%20trick%20is%20to%20select%20inputs%20that%20are%20most%20likely%20to%20cause%20failures%20in%20the%20target%20software.), meaning that it will never 'finish', but if we run it long enough we can be fairly confident that our algorithm is pretty error-proof. I let it run for a few minutes before I declared it a success. 

Great! Let's move onto adding some more functionality to our FSM.

Next:[Regex Processor 5 A bit more theory]({{< ref "Regex-Processor-5-A-bit-more-theory" >}})

Prev:[Regex Processor 3 Starting the compiler]({{< ref "Regex-Processor-3-Starting-the-compiler" >}})