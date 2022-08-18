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

Our tests should all be green still. Let's compare the test structs between this and our previous tests.

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
      if strings.ContainsAny(input, "Ȥ") {  
         t.Skip()  
      }  
  
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