---
title: 5 Wildcards
draft: false
series: ["making regex from scratch in GO"]
---
Let's start adding some special regex characters, starting with the `'.'` wildcard regular expression.

## Wildcards

The `.` character in a regular expression will match any character. To make this clear, here are a few example cases for the regular expression `ab.`;

- `abc` -> `success`
- `ab` -> `normal`

So, let's add these as test cases in our code.

```diff
@@ // fsm_test.go

                {"nested expressions", "a(b(d))c", "abdc"},
                {"substring match with reset needed", "aA", "aaA"},
                {"substring match without reset needed", "B", "ABA"},
                {"multibyte characters", "Ȥ", "Ȥ"},
                {
                        "complex multibyte characters",
                        string([]byte{0xef, 0xbf, 0xbd, 0x30}),
                        string([]byte{0xcc, 0x87, 0x30}),
                },
+               // wildcard
+               {"wildcard regex matching", "ab.", "abc"},
+               {"wildcard regex not matching", "ab.", "ab"},
        }
```

We should get one failing test.

{{% notice info %}} 
Why only one? Well, this is just us getting lucky. Our current implementation doesn't recognize the `.` character, so it treats the regex as though it were `ab`. This means that the input string `abc` correctly matches the regex `ab`, but we incorrectly match the input string `ab` - which should require another character to fulfil the regex `ab.`.
{{% /notice %}} 

As we already tokenize the `.` character in our lexer, we can move directly to the parser. Let's create a new `AST` node type to represent our wildcard.

```diff
@@ // ast.go

 type CharacterLiteral struct {
        Character rune
 }
 
 func (g *Group) Append(node Node) {
        g.ChildNodes = append(g.ChildNodes, node)
 }
 
+type WildcardLiteral struct{}

```

Before we implement the parser logic, let's add a case for it to our parser tests.

```diff
@@ // parser_test.go

        tests := []test{
                {name: "simple string", input: "aBc", expectedResult: &Group{
                        ChildNodes: []Node{
                                CharacterLiteral{Character: 'a'},
                                CharacterLiteral{Character: 'B'},
                                CharacterLiteral{Character: 'c'},
                        },
                }},
+               {name: "wildcard character", input: "ab.", expectedResult: &Group{
+                       ChildNodes: []Node{
+                               CharacterLiteral{Character: 'a'},
+                               CharacterLiteral{Character: 'b'},
+                               WildcardLiteral{},
+                       },
+               }},
        }
```

The implementation should be quite similar to the `CharacterLiteral` parser implementation.

```diff
@@ // parser.go

 func (p *Parser) Parse(tokens []token) Node {
        p.pushNewGroup()
 
        for _, t := range tokens {
                switch t.symbol {
                case Character:
                        node := p.pop()
                        node.Append(CharacterLiteral{Character: t.letter})
                        p.push(node)
+               case AnyCharacter:
+                       node := p.pop()
+                       node.Append(WildcardLiteral{})
+                       p.push(node)
                }
        }
 
        return p.pop()
 }
```

With our parser tests green again, we can implement the `compile` method. This will also be quite similar to the `CharacterLiteral`. The only difference is that the `WildcardLiteral` predicate will return `true` for every rune.

```diff
@@ // parser.go
 
 func (l CharacterLiteral) compile() (head *State, tail *State) {
        startingState := State{}
        endState := State{}
 
        startingState.addTransition(&endState, func(input rune) bool { return input == l.Character })
        return &startingState, &endState
 }
+
+func (w WildcardLiteral) compile() (head *State, tail *State) {
+       startingState := State{}
+       endState := State{}
+
+       startingState.addTransition(&endState, func(input rune) bool { return true })
+       return &startingState, &endState
+}
```

And that's all there is to it! All of our tests should now be green, and we can now parse and match using wildcard characters!

The only thing left to do is to remove our filter of `.` characters in our fuzz tests and to check that the fuzzer can't find any breaking inputs.

```diff
@@ // fsm_test.go

 func FuzzFSM(f *testing.F) {
        f.Add("abc", "abc")
        f.Add("abc", "")
        f.Add("abc", "xxx")
        f.Add("ca(t)(s)", "dog")
 
        f.Fuzz(func(t *testing.T, regex, input string) {
-               if strings.ContainsAny(regex, "[]{}$^|*+?.\\") {
+               if strings.ContainsAny(regex, "[]{}$^|*+?\\") {
                        t.Skip()
                }

```

```zsh
➜ go test ./src/v4/... -fuzz ^FuzzFSM$  
```

We found one...

```zsh
v4_test.go:126: Mismatch - 
	Regex: '..0' (as bytes: 2e2e30), 
	Input: '0
	0' (as bytes: 300a30) 
	-> 
	Go Regex Pkg: 'false', 
	Our regex result: 'true'

```

Again, our fuzzer has uncovered some very interesting behavior of regular expression implementations.

To make clearer what's going on here, let's add a test.

```diff
@@ // fsm_test.go
                // wildcard
                {"wildcard regex matching", "ab.", "abc"},
                {"wildcard regex not matching", "ab.", "ab"},
+               {"wildcards matching newlines", "..0", "0\n0"},
```

We can see here that the `.` wildcard character is matching against the newline character `\n`. In the go regex package, [and in most regex flavors](https://www.regular-expressions.info/dot.html#:~:text=The%20dot%20matches%20a%20single%20character%2C%20without%20caring%20what%20that%20character%20is.%20The%20only%20exception%20are%20line%20break%20characters.%20In%20all%20regex%20flavors%20discussed%20in%20this%20tutorial%2C%20the%20dot%20does%20not%20match%20line%20breaks%20by%20default.), the `.` wildcard does not match the `\n`. This is mainly to avoid common misuse of queries such as `.*` which would otherwise search indefinitely throughout the search input, instead of just limiting the search space to a single line.

This can actually be disabled in most regex flavors with the `singleline` option, although this is disabled by default.

The fix is simple.

```diff
@@ // ast.go

func (w WildcardLiteral) compile() (head *State, tail *State) {
        startingState := State{}
        endState := State{}
 
-       startingState.addTransition(&endState, func(input rune) bool { return true })
+       startingState.addTransition(&endState, func(input rune) bool { return input != '\n' })
        return &startingState, &endState
 }
```

Tests are green again, our fuzzer whizzes along for a few minutes without any complaints, and we've learned a bit more about regular expressions. Not bad!

Next up, modifiers!

{{% notice tip %}} 
Check out this part of the project on GitHub [here](https://github.com/LeweyM/search/tree/master/src/v4)
{{% /notice %}} 