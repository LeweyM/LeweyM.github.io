---
title: 7 Branches
draft: false
series: ["making regex from scratch in GO"]
---
## The OR expression

It's very useful to use a regular expression to match against multiple different possible substrings. For example, to check that a file is an image type, you might use the regular expression `"png|jpge|gif"` on the file extension. This would tell you if the file was `png` OR `jpeg` OR `gif`. The options of the OR expression are determined by the separating them with a `pipe` symbol (`"|"`). 

Let's have a look at what an FSM would look like with OR expressions. Take the regular expression `"dog|cat"` as an example.

![Pasted-image-20220128175219.png](/img/Pasted-image-20220128175219.png)

As we can see, it looks similar to our previous examples, with the notable difference that our starting state has multiple outward `Transitions`. In this case, it can transition on both the `'d'` and the `'c'` characters. 

Let's step through this using the string `"cat"` as our input search string.

![Pasted-image-20220903165828.png](/img/Pasted-image-20220903165828.png)

First, we process the character `'c'`, which matches the bottom transition.

![Pasted-image-20220903165908.png](/img/Pasted-image-20220903165908.png)

Then, we process `'a'`

![Pasted-image-20220903165927.png](/img/Pasted-image-20220903165927.png)

And finally `'t'`, which leaves us in an end state.

![Pasted-image-20220903165948.png](/img/Pasted-image-20220903165948.png)

Pretty simple stuff! Now that we know what we're looking for, let's start coding.

We'll start at the `Parser`.

## Parsing pipes in branches

We're going to want to be able to represent branches as `AST` nodes, so our parser needs to know how to take a regular expression such as `cat|dog` and turn it into a `Branch` AST node with two `Group` child nodes, each containing three `CharacterLiteral` nodes. Visually, the `cat|dog` example should look like this:

```mermaid
graph TD

0(Branch) --> 1(Group)
0 --> 2(Group)
1 --> c[c]
1 --> a[a]
1 --> t[t]
2 --> d[d]
2 --> o[o]
2 --> g[g]
```

Let's start by adding a test to our `parser_test.go` file.

```diff
@@ // parser_test.go

@@ func TestParser(t *testing.T) {
+               {name: "branches", input: "ab|cd|ef", expectedResult: &Branch{ChildNodes: []Node{
+                       &Group{ChildNodes: []Node{
+                               CharacterLiteral{Character: 'a'},
+                               CharacterLiteral{Character: 'b'},
+                       }},
+                       &Group{ChildNodes: []Node{
+                               CharacterLiteral{Character: 'c'},
+                               CharacterLiteral{Character: 'd'},
+                       }},
+                       &Group{ChildNodes: []Node{
+                               CharacterLiteral{Character: 'e'},
+                               CharacterLiteral{Character: 'f'},
+                       }},
+               }}},
        }

```

Let's run those tests and see what we're working with. We get the following error message.

```zsh
Expected [&{ChildNodes:[0x1400000c0d8 0x1400000c0f0 0x1400000c108]}], got [&{ChildNodes:[{Character:97} {Character:98} {Character:99} {Character:100 {Character:101} {Character:102}]}]
```

Hmm, not very helpful. The problem is that displaying hierarchical data structures is not something that Go does very well on it's own. In this case, it's just printing our pointers. We want something more like the tests we've just written - the indentation at each level makes it obvious which `Nodes` are child nodes and which are parent `Nodes`. Let's take another quick detour and improve how we print out our AST `Nodes`.

## Debug printing AST Nodes

We want each level in the hierarchy to be indented a bit more than the previous level, so that we end up with something like this:

```zsh
level 1
  level 2
    level 3
  level 2 
  level 2
level 1
```

We can do this by telling each node which level it is at, and having it print an indentation with the length of that level before it prints the description of the `Node`. Let's start with the leaf nodes, as they're the easiest.

```go
// ast.go

func (l CharacterLiteral) string(indentation int) string {  
   padding := strings.Repeat("--", indentation)  
   return fmt.Sprintf("%sCharacterLiteral('%s')", padding, string(l.Character))  
}  
  
func (w WildcardLiteral) string(indentation int) string {  
   padding := strings.Repeat("--", indentation)  
   return fmt.Sprintf("%sWildcardCharacterLiteral", padding)  
}
```

Now, the `CompositeNodes`, which for now is only `Group`, will also need to print it's description with an indentation. The trick here is to also *ask all of it's child nodes to print with the indentation + 1*.

```go
// ast.go

func (g *Group) string(indentation int) string {  
   return compositeToString("Group", g.ChildNodes, indentation)  
}  
  
func compositeToString(title string, children []Node, indentation int) string {  
   padding := strings.Repeat("--", indentation)  
   res := padding + title  
   for _, node := range children {  
      res += fmt.Sprintf("\n%s%s", padding, node.string(indentation+1))  
   }  
   return res  
}
```

We'll also need to tell Go that every node can print using the `string(indentation int)` method, so let's add it to the `Node` interface.

```diff
@@ // ast.go

 type Node interface {
        compile() (head *State, tail *State)
+       string(indentation int) string
 }
```

And finally call these methods from the composite Nodes `String()` method so that our tests use it for output.

```go
  
func (g *Group) String() string {  
   return "\n" + g.string(0)  
}
```

Now, let's take a look at our error message again.

```zsh
=== RUN   TestParser/branches
    parser_test.go:53: Expected [
        Branch
        --Group
        ------CharacterLiteral('a')
        ------CharacterLiteral('b')
        --Group
        ------CharacterLiteral('c')
        ------CharacterLiteral('d')
        --Group
        ------CharacterLiteral('e')
        ------CharacterLiteral('f')], got [
        Group
        --CharacterLiteral('a')
        --CharacterLiteral('b')
        --CharacterLiteral('c')
        --CharacterLiteral('d')
        --CharacterLiteral('e')
        --CharacterLiteral('f')]
```

That's better, we can now immediately see what's going on.

{{% notice note %}}
It probably seems like we're spending a lot of time building things to help us visualize our system, rather than building the system itself. That's true, and this is a large investment. However, this should pay dividends when it comes to debugging issues that come up, and in simply understanding our system better. 

It's hard to give hard numbers when it comes to deciding whether a tool is worth the time it takes to build it, but considering that the implementation is fairly straight forward, I think it's easily worth it in this case.
{{% /notice %}}

So let's fix our parser.

## Adding Pipes to our Parser

During the parsing of a string of tokens, if we come across the `Pipe` ( `'|'`) token, we want to do one of two things, depending on whether the top `Node` in the stack is a `Branch` node or not.

1. If the top `Node` of the stack is **not** a `Branch` node, want to replace the top of the stack with a new `Branch` node, which will contain the top stack node as its first child, and a new `Group` as its second child.
2. If the top `Node` of the stack is a `Branch` node, we want to 'split' the `Branch` node, which basically means adding a fresh `Group` node as another child of the `Branch` node.

Let's walk through these in more detail.

### 1. Creating a new Branch node

let's parse the regex `"ab|cd"`.

First, the letter `'a'`.
```mermaid
graph TD

0(Group) 
0 --> a[a]
```

Then `'b'`,
```mermaid
graph TD

0(Group) 
0 --> a[a]
0 --> b[b]
```
Now we have our pipe character `'|'`. With this, we should create a new `Branch` node and place our `Group` node as it's first child. We should also create a new `Group` node and it should be a new child of the `Branch` node.
```mermaid
graph TD

0(Branch)
0 --> 1(Group)
0 --> 2(Group)
1 --> a[a]
1 --> b[b]
```
Continuing, we have `'c'`. We should now be appending new expressions to the newly created group (the second child of the `Branch` node).
```mermaid
graph TD

0(Branch)
0 --> 1(Group)
0 --> 2(Group)
1 --> a[a]
1 --> b[b]
2 --> c[c]
```
And finally, `'d'`. The `AST` parsing is now complete.
```mermaid
graph TD

0(Branch)
0 --> 1(Group)
0 --> 2(Group)
1 --> a[a]
1 --> b[b]
2 --> c[c]
2 --> d[d]
```

### 2. Splitting a branch

Let's try parsing the regex `a|b|c`.

First, we parse the `'a'` character.
```mermaid
graph TD

0(Group) --> a[a]
```
Now, our first `'|'` token. This uses the first option, where a new `Branch` is created.
```mermaid
graph TD

0(Branch) --> 1(Group)
0 --> 2(Group)
1 --> a[a]

```
Next, an `'b'` character token. This will be appended to the latest child of `Branch`.
```mermaid
graph TD

0(Branch) --> 1(Group)
0 --> 2(Group)
1 --> a[a]
2 --> b[b]
```

And now, our second `'|'` token. As the top of the stack will now be pointing to a `Branch` node, we will 'split' this branch and create a new child.
```mermaid
graph TD

0(Branch) --> 1(Group)
0 --> 2(Group)
0 --> 3(Group)
1 --> a[a]
2 --> b[b]
```

And finally, the `'c'` character will be appended to the newly created group.
```mermaid
graph TD

0(Branch) --> 1(Group)
0 --> 2(Group)
0 --> 3(Group)
1 --> a[a]
2 --> b[b]
3 --> c[c]
```

## Coding the Pipe Parser

The changes necessary for this are actually quite small. We simply need to add our `Branch` node and a new case in the parsers main `switch` statement.

First, our `Branch` node.

```go 
// ast.go

type Branch struct {  
   ChildNodes []Node  
}

func (b *Branch) Append(node Node) {  
   for i := len(b.ChildNodes) - 1; i > 0; i-- {  
      switch n := b.ChildNodes[i].(type) {  
      case CompositeNode:  
         n.Append(node)  
         return  
      }  
   }  
  
   panic("should have at least one composite node child")  
}

func (b *Branch) compile() (head *State, tail *State) {  
	panic("implement me")
}
```

The `Append` method here is interesting. We want to append to the latest child of the `Branch`, so we iterate backwards through the `ChildNodes`. We also expect that we will always have at least one `CompositeNode` child, so we should panic otherwise.

Also, we add a stand-in `compile` function to get the compiler to stop complaining.

We also need a way to 'split' the branch. This simply means adding a new child with an empty `Group` node.

```go
// ast.go

func (b *Branch) Split() {  
   b.ChildNodes = append(b.ChildNodes, &Group{})  
}
```

And then, in our parser, we add a case for processing `Pipe` tokens.

```diff
@@ // parser.go
		 	for _, t := range tokens {  
			    switch t.symbol {  
			    case Character:  
			 	   node := p.pop()  
				   node.Append(CharacterLiteral{Character: t.letter})  
				   p.push(node)  
			    case AnyCharacter:  
				   node := p.pop()  
				   node.Append(WildcardLiteral{})  
				   p.push(node)
+               case Pipe:
+                       node := p.pop()
+                       switch b := node.(type) {
+                       case *Branch:
+                               b.Split()
+                       default:
+                               node = &Branch{ChildNodes: []Node{node, &Group{}}}
+                       }
+                       p.push(node)
                }

```

This should be enough to get our `Parser` tests green again. Next, we need to compile this AST node into an FSM.

## Compiling a Branch node

We want to take our AST and create a valid FSM from it. This will be enough to make our implementation work, so let's start with a test before we implement anything.

```diff
@@ // fsm_test.go

@@ func TestFSMAgainstGoRegexPkg(t *testing.T) {
                {"wildcard regex matching", "ab.", "abc"},
                {"wildcard regex not matching", "ab.", "ab"},
                {"wildcards matching newlines", "..0", "0\n0"},
+
+               // branch
+               {"branch matching 1st branch", "ab|cd", "ab"},
+               {"branch matching 2nd branch", "ab|cd", "cd"},
+               {"branch not matching", "ab|cd", "ac"},
        }

```

These should be failing as we simply panic when we try to compile any `Branch` AST `Nodes`. Let's fix this.

Going from this:

```mermaid
graph TD

0(Branch) --> 1(Group)
0 --> 2(Group)
1 --> c[c]
1 --> a[a]
1 --> t[t]
2 --> d[d]
2 --> o[o]
2 --> g[g]
```

To this:

![Pasted-image-20220128175219.png](/img/Pasted-image-20220128175219.png)


Is not too difficult. They already share a lot of the same characteristics because the shape is so similar. As I've stressed in earlier chapters, parsing the structure first and then compiling the end result separately is a fantastic way to reduce the overall complexity of this operation.

For now, we can use the following algorithm for parsing a `Branch` node:

1. Create a starting `State`.
2. Compile each child node, and merge the first `State` of each child with the starting `State`.

This has some issues, as we'll see later, but for now this will work. Let's put it into code.

```go
// ast.go 

func (b *Branch) compile() (head *State, tail *State) {  
	// 1. Create a starting State.
	startState := &State{}  
	
	// 2. Compile each child node, and merge the first State of each child with the starting State.
	for _, expression := range b.ChildNodes {  
		nextStateHead, _ := expression.compile()  
		startState.merge(nextStateHead)  
	}  
	return startState, startState  
}
```

That should be enough to successfully compile a `Branch` node. Our tests should now be green, so let's see what we've created by using our visualizer tools.

Let's see what happens when we run the `draw "ab|cd|ef" "aaccef"` command. We should get something like the following in the browser.

![branch-regex-demo.gif](/img/branch-regex-demo.gif)

Looks great! Our FSM looks exactly as we'd expect, and our algorithm (after quite a bit of backtracking) eventually finds the correct match. 

There is one deep dark problem here though which we've been conveniently ignoring, and it goes right to the heart of finite state machines.

## Deterministic vs Non-Deterministic State Machines

Our examples up until now have all worked fine because they have one thing in common; every `State` has **only one transition for each character** in the alphabet. Because of this, we know exactly which state will be red after we process a character. What happens if we get rid of this invariant? How can our FSM behave?

Consider the following FSM for the regular expression `dog|dot`:

![Pasted-image-20220128175308.png](/img/Pasted-image-20220128175308.png)

We can condense the problem into an even simpler FSM:

```mermaid
graph LR

0((0)) --a--> 1((1))
0((0)) --a--> 2((2))

style 0 fill:#ff5555;
```

If we process the character `'a'`, what should happen? Should we go `State 1` or to `State 2`? Or should we go to both?

The answer to this question is the difference between a **Deterministic Finite State Automata (DFA)** and a **Non-Deterministic Finite State Automata (NFA)**. 

A DFA cannot have more than one transition with the same character from a single state. It requires that only a single state can be active at any time, and that once a state is processed with a character, we know deterministically in which state we will be in afterwards.

In an NFA, there is no such restriction. If there are multiple possible transitions for a given character, both states can be examined. One can imagine this as either multiple states being active on an FSM, or multiple FSMs being traversed in parallel. The result is the same.

Up until now, we have been using a DFA. Now we're going to change our model to an NFA in order to be able to process the type of FSM I've shown above.

### Changing to a NFA model

First, let's add a test which illustrates our issue.

```diff
@@ fsm_test.go

@@ func TestFSMAgainstGoRegexPkg(t *testing.T) {
                {"wildcard regex matching", "ab.", "abc"},
                {"wildcard regex not matching", "ab.", "ab"},
                {"wildcards matching newlines", "..0", "0\n0"},

                // branch
                {"branch matching 1st branch", "ab|cd", "ab"},
                {"branch matching 2nd branch", "ab|cd", "cd"},
                {"branch not matching", "ab|cd", "ac"},
+               {"branch with shared characters", "dog|dot", "dog"}, // will work
+               {"branch with shared characters", "dog|dot", "dot"}, // will not work
        }

```

So, from our tests we can see that we will find `dog`, but not `dot`. Let's take a look at our visualizer to understand why.

![dog-branch-regex-demo-1.gif](/img/dog-branch-regex-demo-1.gif)

So, when searching for `"dog"`, we travel through the upper branch and successfully find a match. Nothing surprising here. Let's look at `"dot"`.

![dot-branch-regex-demo-2.gif](/img/dot-branch-regex-demo-2.gif)

Ah... when matching the first `'d'` character, we go up the same branch as before. How can the program know which branch it should follow? As it can't see into the future, there are two possibilities.
1. Backtracking
2. Parallel States

Backtracking would mean travelling backwards to the route of the branch in the case of failure, then trying the next `Transition` for the `'d'` character. We can think of this as a form of **Depth First Search** as we optimistically explore the first branch, then go back in the case of failure.

Parallel States would mean going down all the possible branches simultaneously, exploring every state for which there is a valid `Transition`. You can think of this as a **Breadth First Search** of the FSM.

We're going to be exploring the second option in our program.

