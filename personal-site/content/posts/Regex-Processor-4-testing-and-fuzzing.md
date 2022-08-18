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
      {"nested expressions", "a(b(d))c", "abdc"},  
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

