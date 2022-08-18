---
title: Regex Processor 4 testing and fuzzing
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
  
         if (result == Success && !goRegexMatch) || (result != Success && goRegexMatch) {  
            t.Fatalf("Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'", tt.regex, tt.input, goRegexMatch, result)  
         }  
      })  
   }  
}
```

Most of the testing logic is in the `matchRegex` function, so let's define that also.

```Go
func matchRegex(regex, input string) Status {  
   parser := NewParser()  
   tokens := lex(regex)  
   ast := parser.Parse(tokens)  
   startState, _ := ast.compile()  
   testRunner := NewRunner(startState)  
  
   for _, character := range input {  
      testRunner.Next(character)  
   }  
  
   return testRunner.GetStatus()  
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
      if strings.ContainsAny(regex, "$^|*+?.\\") {  
         t.Skip()  
      }  
  
      compiledGoRegex, err := regexp.Compile(regex)  
      if err != nil {  
         t.Skip()  
      }  
  
      result := matchRegex(regex, input)  
      goRegexMatch := compiledGoRegex.MatchString(input)  
  
      if (result == Success && !goRegexMatch) || (result == Fail && goRegexMatch) {  
         t.Fatalf("Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'", regex, input, goRegexMatch, result)  
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
      if strings.ContainsAny(regex, "$^|*+?.\\") {  
         t.Skip()  
      }  
  
      compiledGoRegex, err := regexp.Compile(regex)  
      if err != nil {  
         t.Skip()  
      }  
  
      result := matchRegex(regex, input)  
      goRegexMatch := compiledGoRegex.MatchString(input)  
  
      if (result == Success && !goRegexMatch) || (result == Fail && goRegexMatch) {  
         t.Fatalf("Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'", regex, input, goRegexMatch, result)  
      }  
   })  
```

First, we want to ignore some special regex characters (for now), so any tests which use these characters we will simply ignore;

```Go
if strings.ContainsAny(regex, "$^|*+?.\\") {  
	t.Skip()  
}  
```

Also, we only want to test valid regex statements, so any invalid statements we can also ignore.

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

if (result == Success && !goRegexMatch) || (result == Fail && goRegexMatch) {  
	t.Fatalf("Mismatch - Regex: '%s', Input: '%s' -> Go Regex Pkg: '%t', Our regex result: '%v'", regex, input, goRegexMatch, result)  
}  
```

Let's see what happens when we run this fuzz test. Use the following command line instruction;

```
go test ./src/v3/... -fuzz ^FuzzFSM$
```

Note: Your path might be different, use the path of the package with the test and FSM implementation.



