---
title: 6 Pretty Vizualizations
draft: false
series: ["making regex from scratch in GO"]
---
Now that we have a few features working, this is a good time to take a step back and build some things to help us see what we're working with. The tools we're going to build now will help with debugging as our features become more complex, and will give us a clearer picture of the logic of the systems we're working with.

As a side note, I also think it's worth mentioning that an important part of building a (kinda) sophisticated system is maintaining the developer infrastructure around it. That can be anything from tests, build tools, debugging tools - anything that helps you get your head around the system and manage that complexity.

So, let's build something to help us *see*.

## Visualizing Graphs

The issue we have is that it's not very easy to visualize a set of connected nodes (a graph) using variables and text. We *could* do it, and trace the pointer hashes from one object to the next, but it's not going to be very fun. As our system scales in complexity, this method will get more and more tedious.

As the old adage goes, a picture tells a thousand words...

We're going to produce something like this:

```mermaid
graph LR
10((1)) --a-->

20((2)) --b-->

30((3)) --c-->

40((4)) --d--> 50((5))

40((4)) --e--> 60((6))
```
This visual representation of our FSM will give us a quick insight into whether we've compiled the regular expression correctly, and let us run through the steps ourselves to check when things go wrong.

This was created using `mermaid.js`.

## Mermaid.js for graphs

`mermaid.js` is a fantastic tool which allows us to write graphs in standard markdown which can be then rendered in the browser. The markdown for the above graph is the following;

```markdown
Graph LR
	1((1)) --a-->
	2((2)) --b-->
	3((3)) --c-->
	4((4)) --d--> 5((5))
	4((4)) --e--> 6((6))
```

{{% notice info %}} 
`mermaid` is much more powerful than this and has all sorts of wild and wonderful features. Check out [the docs](https://mermaid-js.github.io/mermaid) and see.
{{% /notice %}} 

This is simple enough, we just need to parse our `States` and `Transitions` into the numbers and arrows in the markdown above.

As always, let's start with some tests to help define our objective.

```go
// draw_test.go

func Test_DrawFSM(t *testing.T) {  
   type test struct {  
      name, regex, expected string  
   }  
  
   tests := []test{  
      {  
		 name:  "simple example" 
         regex: "abc",  
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))`,  
      },  
      {  
         name:  "example with whitespace",
         regex: "a b",  
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --" "--> 2((2))  
2((2)) --"b"--> 3((3))`,  
      },  
   }  
  
   for _, tt := range tests {  
      t.Run(tt.name, func(t *testing.T) {  
		 drawing := NewMyRegex(tt.regex).DebugFSM()
  
         if drawing != tt.expected {  
            t.Fatalf("Expected drawing to be \n\"%s\", got\n\"%s\"", tt.expected, drawing)  
         }  
      })  
   }
```

This test is pretty straight forward, let's just zoom in on a couple of things.

The `DebugFSM()` method is new, it's what we want to implement to get this test to pass.

```go
// draw_test.go 

drawing := NewMyRegex(tt.input).DebugFSM()
```

It will produce a `string` with the lines and numbers needed for our `mermaid` markdown.

```go
// draw_test.go 

   tests := []test{  
      {  
		 name:  "simple example" 
         regex: "abc",  
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))`,  
      },  
      {  
         name:  "example with whitespace",  
		 regex: "a b",
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --" "--> 2((2))  
2((2)) --"b"--> 3((3))`,  
      },  
   }  
```

Here are our test cases. They're quite simple also, as they show simple cases of single character transition FSMs, and also a case for whitespaces.

Now that we have some red tests, we can start implementing the `DebugFSM()` method.

First, we don't want the logic of drawing an FSM to live on the `myRegex` object. This makes sense to be a method of the `State` object, so let's pass the responsibility over to that.

```go
// regex.go
  
func (m *myRegex) DebugFSM() string {  
   graph := m.fsm.Draw()  
   return graph  
}
```

Now let's start work on the `Draw()` function.

## Traversal

We need a line for every `Transition` in our FSM. Generically speaking, this means we need to look at every 'vertex' in our 'directed graph' (digraph). So, what we have here is a **graph traversal problem**. 

There are two generic ways to traverse a graph; Breadth-First Search (BFS) and Depth-First Search (DFS). How we visit every vertex will determine the order of the lines in our `mermaid` markdown. It doesn't make a huge difference, but DFS should lead to longer chains of connected nodes being drawn first. Another advantage of DFS is that our traversal algorithm can be defined recursively.

Our algorithm for collecting all the `Transitions` of the FSM should look something like this;

```go
// from the root node

1. If the current node has already been visited, stop.
2. Add the transitions from this node to a set of transitions.
3. Mark the current node as visited.
4. Recur on the destination node of every outgoing transition.
5. Recur on the source node of every incoming transition.
```

The order of the recursions is important here. We want to first collect the outgoing transitions of all the nodes, and then, starting from the last node and going backwards, collect the transitions of any unvisited nodes connected by incoming transitions.

I won't labor the point here, as it's tricky to visualize what's going on and distracts from what we're trying to do here. If this is mysterious to you, try walking step by step through the call stack and see where you end up.

In this algorithm, we have a common need - we need to maintain a set of `Transitions` and `States`, as well as maintain their insertion order. The insertion order will be necessary for printing the `Transitions` in the correct order, as well as numbering the `State` nodes correctly.

Let's build a generic `OrderedSet` data structure to manage this for us.

## OrderedSet

We can use the new Generics features of Go 1.18 to write this generically and use the same structure for both 'visited' `*States` and `Transitions`.

{{% notice info %}} 
Notice that we want a set of `State` pointers, and a set of concrete `Transitions`. This is because `Transitions` contain all of their identifying information, such as their `to` and `from` states, and the predicate, as fields in the struct. `States`, on the other hand, require a reference to be identified.
{{% /notice %}} 

Before we get into the generic implementation, we need to do some refactoring of `Transition` in order to make it `comparable` in Go (not a slice, map, or function type). 

### Modifying the Transition object

In go, an object is `comparable` when all of its fields are also `comparable`, and currently the `predicate` field of a `Transition` is a function type. Let's change that now.

```diff
- type Predicate func(input rune) bool
```

Instead, let's use a struct which can have either a string of allowed or disallowed chars[^generics].

[^generics]: This feels pretty clunky. I would have preferred a dynamic type which implements an interface, but interface fields on structs also have problems implementing the `comparable` interface. So far, generics are still tricky to make work in Go, but it's still early days.

```go
// transition.go

type Predicate struct {  
   allowedChars    string  
   disallowedChars string  
}  
  
func (p Predicate) test(input rune) bool {  
   if p.allowedChars != "" && p.disallowedChars != "" {  
      panic("must be mutually exclusive")  
   }  
  
   if len(p.allowedChars) > 0 {  
      return strings.ContainsRune(p.allowedChars, input)  
   }  
   if len(p.disallowedChars) > 0 {  
      return !strings.ContainsRune(p.disallowedChars, input)  
   }  
   return false  
}
```

And let's make a few changes so that our problem compiles.

```diff
@@ // state.go

 func (s *State) firstMatchingTransition(input rune) *State {
        for _, t := range s.transitions {
+               if t.predicate.test(input) {
-               if t.predicate(input) {
                        return t.to
                }
        }

	return nil
}

// ...

func (l CharacterLiteral) compile() (head *State, tail *State) {
        startingState := State{}
        endState := State{}
 
-       startingState.addTransition(&endState, func(input rune) bool { return input == l.Character }, string(l.Character))
+       startingState.addTransition(&endState, Predicate{allowedChars: string(l.Character)}, string(l.Character))
        return &startingState, &endState

// ...

func (w WildcardLiteral) compile() (head *State, tail *State) {  
   startingState := State{}  
   endState := State{}  
-  startingState.addTransition(&endState, func(input rune) bool { return input != "\n" }, string(l.Character))  
+  startingState.addTransition(&endState, Predicate{disallowedChars: "\n"}, ".")  
   return &startingState, &endState  
}

```

And now, let's build our generic `OrderedSet` struct. Our struct will need the following interface, where `T` is the generic type:
- `add(t T)`
- `has(t T) bool`
- `list() []T`
- `getIndex(t T) int`

Let's write that out.

```go
// orderedset.go

// OrderedSet maintains an ordered set of unique items of type <T>type 
OrderedSet[T comparable] struct {  
   set       map[T]int  
   nextIndex int  
}  
  
func (o *OrderedSet[T]) add(t T) {  
   if o.set == nil {  
      o.set = make(map[T]int)  
   }  
  
   if !o.has(t) {  
      o.set[t] = o.nextIndex  
      o.nextIndex++  
   }  
}  
  
func (o *OrderedSet[T]) has(t T) bool {  
   _, hasItem := o.set[t]  
   return hasItem  
}  
  
func (o *OrderedSet[T]) list() []T {  
   size := len(o.set)  
   list := make([]T, size)  
  
   for t, i := range o.set {  
      list[i] = t  
   }  
  
   return list  
}  
  
func (o *OrderedSet[T]) getIndex(t T) int {  
   return o.set[t]  
}
```

We've changed the implementation here slightly by storing the index in the `set` field. This makes our `list` method a little more awkward, but it makes it easier to get the index of any item in the set, which will be useful for finding the numbers of our nodes.

Now we have all the pieces we need for our traversal algorithm.

## Writing the node traversal algorithm

Because of the useful data structures we've just dreamed up, writing the traversal algorithm maps pretty simply to the pseudocode we described earlier.

```go
func visitNodes(  
   node *State,  
   transitions *OrderedSet[Transition],  
   visited *OrderedSet[*State],  
) {  
   // 1. If the current node has already been visited, stop.  
   if visited.has(node) {  
      return  
   }  
  
   // 2. Add the transitions from this node to a set of transitions.  
   for _, transition := range node.transitions {  
      transitions.add(transition)  
   }  
  
   // 3. Mark the current node as visited.  
   visited.add(node)  
  
   // 4. Recur on the destination node of every outgoing transition.  
   for _, transition := range node.transitions {  
      destinationNode := transition.to  
      visitNodes(destinationNode, transitions, visited)  
   }  
   // 5. Recur on the source node of every incoming transition.  
   for _, sourceNode := range node.incoming {  
      visitNodes(sourceNode, transitions, visited)  
   }  
}
```

It's important that the `transitions` and the `visited` `OrderedSets` are passed by reference using pointers. They should be the same instance in every recursive call, as we want to collect `Transitions` and mark `Nodes` as visited across the whole graph.

Once we have collected the `Transitions`, we now just have to draw them as lines in our `mermaid` markdown.

```go
func (s *State) Draw() string {  
   // initialize sets  
   transitionSet := OrderedSet[Transition]{}  
   nodeSet := OrderedSet[*State]{}  
  
   // collect transitions  
   visitNodes(s, &transitionSet, &nodeSet)  
  
   output := []string{  
      "graph LR",  
   }  
  
   // draw transitions  
   for _, t := range transitionSet.list() {  
      fromId := nodeSet.getIndex(t.from)  
      toId := nodeSet.getIndex(t.to)  
      output = append(output, fmt.Sprintf("%d((%d)) --\"%s\"--> %d((%d))", fromId, fromId, t.debugSymbol, toId, toId))  
   }  
   return strings.Join(output, "\n")  
}
```

Once all the hard work of collecting the `Nodes` and `Transitions` is done, it's quite simple to concatenate the strings required to build the `mermaid.js` code. I won't go into much more detail here, as the code seems to speak for itself.

With all this in place, let's run our tests.

```zsh
=== RUN   Test_DrawFSM
=== RUN   Test_DrawFSM/abc
    draw_test.go:38: Expected drawing to be 
        "graph LR
        0((0)) --"a"--> 1((1))
        1((1)) --"b"--> 2((2))
        2((2)) --"c"--> 3((3))", got
        "graph LR
        0((0)) --"a"--> 1((1))
        1((1)) --"b"--> 2((2))
        2((2)) --"c"--> 3((3))
        4((4)) --"c"--> 3((3))
        5((5)) --"b"--> 2((2))
        6((6)) --"a"--> 1((1))"
=== RUN   Test_DrawFSM/a_b
    draw_test.go:38: Expected drawing to be 
        "graph LR
        0((0)) --"a"--> 1((1))
        1((1)) --" "--> 2((2))
        2((2)) --"b"--> 3((3))", got
        "graph LR
        0((0)) --"a"--> 1((1))
        1((1)) --" "--> 2((2))
        2((2)) --"b"--> 3((3))
        4((4)) --"b"--> 3((3))
        5((5)) --" "--> 2((2))
        6((6)) --"a"--> 1((1))"
--- FAIL: Test_Draw (0.00s)
    --- FAIL: Test_Draw/abc (0.00s)

    --- FAIL: Test_Draw/a_b (0.00s)
```

Hmm, interesting. Not quite what we were expecting. To see what's going on, let's plug the output graph of our `abc` test into [mermaids live coding site](https://mermaid.live/) and see what we're looking at.

```markdown
graph LR
        0((0)) --"a"--> 1((1))
        1((1)) --"b"--> 2((2))
        2((2)) --"c"--> 3((3))
        4((4)) --"c"--> 3((3))
        5((5)) --"b"--> 2((2))
        6((6)) --"a"--> 1((1))
```

```mermaid
graph LR
        0((0)) --"a"--> 1((1))
        1((1)) --"b"--> 2((2))
        2((2)) --"c"--> 3((3))
        4((4)) --"c"--> 3((3))
        5((5)) --"b"--> 2((2))
        6((6)) --"a"--> 1((1))
```

That's certainly not right. We seem to have dangling `Nodes` which still have `Transitions` to intermediary nodes. This should not affect the accuracy of our regex engine, as `States` `4`, `5`, and `6` cannot be reached, but it does make our drawing a bit distracting.

The error here is in our `state.Merge` method.

```go
// adds the transitions of other State (s2) to this State (s).
//  
// warning: do not use if State s2 has any incoming transitions.  
func (s *State) merge(s2 *State) {  
   if len(s2.incoming) != 0 {  
      panic(fmt.Sprintf("State (%+v) cannot be merged if it has any incoming transitions. It has incoming transitions from the following states; %+v", *s2, s.incoming))  
   }  
  
   for _, t := range s2.transitions {  
      s.addTransition(t.to, t.predicate, t.debugSymbol)  
	}
}
```

Let's see this in a simpler example, the regex `a`.

```mermaid
graph LR 
0((0)) --"a"--> 1((1)) 
2((2)) --"a"--> 1((1))
```

Remember how the `compile` method of a `Group` node works? First we compile the `CharacterLiteral(a)` Node into a two-state FSM. We then create a new `State`, onto the tail of which we will merge all the children FSMs

```mermaid
graph LR
0((0))
1((1)) --"a"--> 2((2))
```

In this simple example, there is one merge operation, during which we copy all the transitions from ` State 1` onto `State 0`. So...

```mermaid
graph LR
0((0)) -."merge".-1((0))
1((1)) --"a"--> 2((2))
```

Becomes...

```mermaid
graph LR
10((0)) --"a"--> 20((2))
30((1)) --"a"--> 20((2))
```

The problem is that the transition from `1` to `2` remains, which leads to the dangling `State` `1` remaining in our drawing.

Let's remove those dangling transitions. When merging transitions, we want to;
1. copy the transitions from `State 1` to `State 0`
2. delete `State 1`

Let's create a couple of methods on the `State` struct to delete a node. In our context, 'deleting' means removing all the incoming and outgoing transitions[^gc].
[^gc]: Technically it's not really being deleted as it will still exist in memory. However, as we have removed all pointers to and from the `State`, it will not have any effect on our program, and it will eventually be removed by the garbage collector.

```go
func (s *State) delete() {  
   // 1. remove s from incoming of connected nodes.  
   for _, t := range s.transitions {  
	  t.to.removeIncoming(s)
   }  
  
   // 2. remove the outgoing transitions  
   s.transitions = nil  
} 

func (s *State) removeIncoming(target *State) {  
   var newIncoming []*State  
   for _, state := range s.incoming {  
      if target != state {  
         newIncoming = append(newIncoming, state)  
      }  
   }  
   s.incoming = newIncoming  
}
```

And now let's delete our extra `State` after the merge is complete.

```diff 
func (s *State) merge(s2 *State) {  
		// [...]  
  
        for _, t := range s2.transitions {
+               // 1. copy s2 transitions to s
                s.addTransition(t.to, t.predicate, t.debugSymbol)
        }
+
+       // 2. remove s2
+       s2.delete()

   }  
}  
```

Now, running our tests should pass, and the output of our `abc` regex FSM should look correct.

```mermaid
graph LR 
0((0)) --"a"--> 1((1)) 
1((1)) --"b"--> 2((2)) 
2((2)) --"c"--> 3((3))
```
Although nothing was strictly broken in our system, I hope that this demonstrates how useful it is to have tools like this for debugging a complex system.

## A quick command line tool

Let's add one more thing before we finish with our visualizer. We want to be able to use it, quickly and easily, so let's make a command that we can run which takes a regular expression and shows us what the compiled FSM looks like.

Let's set up a `main` function[^2].

[^2]: I prefer some misdirection between the main function in order to strip away unnecessary command arguments. You might prefer to simply call `Draw` from the `main` package.

```go
package main

func main() {  
   switch os.Args[1] {  
   case "v5":  
      v5.Main(os.Args[2:])  
      return  
   }
}
```

```go
package v5

// Main just used for linking up the main functions
func Main(args []string) {  
   switch args[0] {  
   case "draw":  
      if len(args) == 2 {  
         RenderFSM(args[1])  
      }
   default:  
      fmt.Println("command not recognized")  
   }  
}
```

With that, we can call `Draw` from our command. Let's test that things are set up correctly.

```go
func Draw(input string) {
	fmt.Println("Draw called with " + input)
}
```

We can run the program with `go run ./.. v5 draw {input}`.

```zsh
➜  search git:(master) ✗ go run ./... v5 draw "abc"

Draw called with abc
```

Great, let's make `Draw()` open a browser and display our `mermaid` code. 

```go

// main.go

func RenderFSM(input string) {  
   graph := NewMyRegex(input).DebugFSM()  
   renderTemplateToBrowser(fsmTemplate, graph)  
}

func renderTemplateToBrowser(tmplt string, data any) {  
   t, err := template.New("graph").Parse(tmplt)  
   if err != nil {  
      panic(err)  
   }  
   w := bytes.Buffer{}  
   err = t.Execute(&w, data)  
   if err != nil {  
      panic(err)  
   }  
  
   reader := strings.NewReader(w.String())  
   err = browser.OpenReader(reader)  
   if err != nil {  
      panic(err)  
   }  
   return  
}
```

The template we're using here in the constant `fsmTemplate` is defined in the following [github link](https://github.com/LeweyM/search/blob/c31ebe6066a6cabd74ef2afadaee20a81a875d2a/src/v5/templates.go#L14-L24). This is some dirty and ugly HTML. It gets the job done, but it's not something I want to focus on here - if you're following along with this guide, I suggest you copy it directly from github.

Let's try that again. It should now open a browser with a visualization of your compiled FSM!

```mermaid
graph LR 
0((0)) --"a"--> 1((1)) 
1((1)) --"b"--> 2((2)) 
2((2)) --"c"--> 3((3))
```
That's better. This tool is going to come in very handy as our program grows in complexity.

So, we can visualize what a compiled FSM looks like, but what would be great is if we could also see our *runner processing each of the characters*. This would give us a wonderful insight into the characteristics of our algorithm.

Let's do that now.

## Visualizing the Runner

What I want is to be able to open up a browser with an animation that shows me;
1. The compiled FSM (as we just showed)
2. Which character of the input I'm currently processing.
3. Which is the current active state in the FSM.

We already implemented (1), so now we need a way of showing (2) where we are in the input string and (3) which state is currently active for each step of the algorithm. To be clear, when I write 'step', I refer to the processing of a character via the `Next(input rune)` method in our `runner`.

In terms of displaying this information, we can do this by simply rendering every step of the algorithm in the browser, and then use JavaScript to reveal one of the steps and hide the others when the arrow keys are pressed. This will give the impression of stepping backwards and forwards through the algorithm[^js].

[^js]: If for some reason you're interested in the hacky javascript involved in this, take a look at the `templates.go` file in [github](https://github.com/LeweyM/search/blob/master/src/v5/templates.go).

We need a way of drawing the graph each step in the algorithm. In this case, the algorithm in question is the `match` algorithm, so let's create a `DebugMatch()` function on our `myRegex` struct to handle this.

```go
// regex.go

func (m *myRegex) DebugMatch(input string) []debugStep {
	// todo: implement me
}
```

This returns a slice of `debugSteps`, which contains everything we need in order to render a single step in the algorithm. Namely, a drawing of the runner in the current moment, and the index of the character we're processing in the current moment.

```go
type debugStep struct {  
   runnerDrawing         string  
   currentCharacterIndex int  
}
```

Let's start with a test;

```go
// draw_test.go

func Test_DrawSnapshot(t *testing.T) {  
   type test struct {  
      name, regex, input, expected string  
   }  
  
   tests := []test{  
      {  
         name:  "initial snapshot",  
         regex: "abc",  
         input: "",  
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))  
style 0 fill:#ff5555;`,  
      },  
      {  
         name:  "after a single letter",  
         regex: "abc",  
         input: "a",  
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))  
style 1 fill:#ff5555;`,  
      },  
      {  
         name:  "last state highlighted",  
         regex: "aaa",  
         input: "aaa",  
         expected: `graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"a"--> 2((2))  
2((2)) --"a"--> 3((3))  
style 3 fill:#00ab41;`,  
      },  
   }  
  
   for _, tt := range tests {  
      t.Run(tt.name, func(t *testing.T) {  
         tokens := lex(tt.regex)  
         parser := NewParser()  
         ast := parser.Parse(tokens)  
         state, _ := ast.compile()  
         runner := NewRunner(state)  
         for _, char := range tt.input {  
            runner.Next(char)  
         }  
         snapshot := runner.drawSnapshot()  
  
         if !reflect.DeepEqual(tt.expected, snapshot) {  
            t.Fatalf("Expected drawing to be \n\"%v\"\ngot\n\"%v\"", tt.expected, snapshot)  
         }  
      })  
   }  
}
```

This should look familiar to our previous `Test_DebugFSM` test, with the biggest difference being that now we are returning a slice of drawings, along with the `currentCharacterIndex`, for each frame (or step) of the algorithm. 

Zoom in on the first step of the algorithm.

```go
`graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))  
style 0 fill:#ff5555;`
```

One thing that wasn't in the previous test is the last line.

```markdown
style 0 fill:#ff5555;
```

This gives a color `#ff5555` to the node with the label '`0`'. Let's see what this looks like with `mermaid`.

```mermaid
graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))  
style 0 fill:#ff5555;
```
The red node means that the current state is `State` '`0`'. Let's change the last line to `style 1 fill:#ff5555`

```mermaid
graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))  
style 1 fill:#ff5555
```
So, by changing which node we style, we can demonstrate the currently active state 'moving' across our FSM.

Finally, some might notice that the last graph in our test has a different color. 

```mermaid
graph LR  
0((0)) --"a"--> 1((1))  
1((1)) --"b"--> 2((2))  
2((2)) --"c"--> 3((3))  
style 3 fill:#00ab41;
```

The green node means that the runner has landed in an end state, and so the match was successful. 

Now we know what we trying to build, let's start implementing. The first thing we're going to need to do is to modify the `match` method to allow us to gather information at various stages of the algorithm. In order to do this, we're going to make use of golang's `channels` to send data as the algorithm is running. 

Go `channels` are used for concurrent programs, which is not really how we're using them here. However, by using channels we can 'enqueue' data during the processing of a function without the function returning. As long as something is 'listening' on the other side of the channel, the `send` operation to the channel will not block. If you're not familiar with Go `channels`, this will likely be a bit mysterious for now, hopefully it will be clearer once we have some working code.

The upside of all this is that we don't need to modify the original algorithm too much. Let's start with the `match` function.

### Changing our Match Function

```diff
@@ // regex.go

-func match(runner *runner, input []rune) bool {
+func match(runner *runner, input []rune, debugChan chan debugStep, offset int) bool {
        runner.Reset()
+       if debugChan != nil {
+               debugChan <- debugStep{runnerDrawing: runner.drawSnapshot(), currentCharacterIndex: offset}
+       }
 
-       for _, character := range input {
+       for i, character := range input {
                runner.Next(character)
+               if debugChan != nil {
+                       debugChan <- debugStep{runnerDrawing: runner.drawSnapshot(), currentCharacterIndex: offset + i + 1}
+               }
                status := runner.GetStatus()
 
                if status == Fail {
-                       return match(runner, input[1:])
+                       return match(runner, input[1:], debugChan, offset+1)
                }
 
				if status == Success {  
				      return true  
			    }  
		}   
  
		return runner.GetStatus() == Success
}

```

Let's break this down a bit;

First, the signature has changed.

```diff
-func match(runner *runner, input []rune) bool {
+func match(runner *runner, input []rune, debugChan chan debugStep, offset int) bool {
```

We now pass a `chan debugStep`  channel to `match`. This is the channel to which we will output our graph drawing at each step of the algorithm. 

We also pass an `offset` integer to the function. This is because of the recursive nature of the algorithm, which means that at each step we are operating on an ever shortening substring of `input`. For example, it will operate first on the string `"abcd"`, then `"bcd"`, then `"cd"`, then `"d"`, and then finally on the empty string `""`. As we need to know which index of the *complete* `input` string we're currently at, we need to know how many characters we've already discarded. Therefore, the `offset` is incremented in every recursion to account for this.

```diff
                if status == Fail {
-                       return match(runner, input[1:])
+                       return match(runner, input[1:], debugChan, offset+1)
                }
```

The other modifications are simple, we just pass the current state of the `runner` and the `currentCharacterIndex` to the channel at each step.

```diff
        runner.Reset()
+       if debugChan != nil {
+               debugChan <- debugStep{runnerDrawing: runner.drawSnapshot(), currentCharacterIndex: offset}
+       }
 
-       for _, character := range input {
+       for i, character := range input {
                runner.Next(character)
+               if debugChan != nil {
+                       debugChan <- debugStep{runnerDrawing: runner.drawSnapshot(), currentCharacterIndex: offset + i + 1}
+               }
```

We do it before the loop in order to capture the state of the runner at the very beginning, before it has processed any characters, as well as whenever the algorithm recurs. This leads to some jumps in our animation, but it shows nicely the 'backtracking' characteristics of our algorithm.

We also capture the runner state after the `runner.Next(character)` call during the loop in order to take a snapshot of every step after a character has been processed.

And finally, we always check that `debugChan != nil` before we pass data to the `debugStep` channel so that we can ignore all of this when we're not debugging.

The compiler should be moaning at us to fix what we've broken, so let's fix that.

```diff
@@ // regex.go

 func (m *myRegex) MatchString(input string) bool {
        testRunner := NewRunner(m.fsm)
-       return match(testRunner, []rune(input))
+       return match(testRunner, []rune(input), nil, 0)
 }
```

That should be enough. We now have some failing tests to fix, so let's implement the `DebugMatch()` method.

```go
// regex.go

func (m *myRegex) DebugMatch(input string) []debugStep {  
   testRunner := NewRunner(m.fsm)  
   debugStepChan := make(chan debugStep)  
   go func() {  
      match(testRunner, []rune(input), debugStepChan, 0)  
      close(debugStepChan)  
   }()  
   var debugSteps []debugStep  
   for step := range debugStepChan {  
      debugSteps = append(debugSteps, step)  
   }  
  
   return debugSteps  
}
```

Again, if you're not familiar with Go `channels` this might look odd, so let's step through it.

First, we create a runner and a new `chan debugStep` 
```go
   testRunner := NewRunner(m.fsm)  
   debugStepChan := make(chan debugStep)
```

Then, we start a new `Go routine` which will call `match` and use our previously created channel. Once `match` has finished, the `channel` will be closed.

```go
   go func() {  
      match(testRunner, []rune(input), debugStepChan, 0)  
      close(debugStepChan)  
   }()  
```

Finally, we immediately start collecting the data sent to the channel and adding it to a slice. Once `match` has returned in the other `Go routine`, the `range` loop will terminate and we can return the slice.

```go
   var debugSteps []debugStep  
   for step := range debugStepChan {  
      debugSteps = append(debugSteps, step)  
   }  
  
   return debugSteps 
```

That should be enough to get our tests passing!

### A new command

We now want to be able to use this by calling something from the command line, as we did before. Let's modify our `main.go` file.

```diff
@@ // main.go

// Main just used for linking up the main functionsfunc Main(args []string) {  
   switch args[0] {  
   case "draw":  
      if len(args) == 2 {  
         RenderFSM(args[1])  
+     } else if len(args) == 3 {  
+        RenderRunner(args[1], args[2])  
+     }  
   default:  
      fmt.Println("command not recognized")  
   }  
}
```

This means that if we call our method with a single string, such as `go run ./... v5 cat`, we display the compiled FSM for the regular expression `"cat"`, but if we call with two strings, such as `go run ./... v5 cat "I love cats"`, we get a representation of our algorithm for the regular expression `"cat"` being applied to the input string `"I love cats"`.

Let's implement `RenderRunner`.

```go
// main.go

// RenderRunner will render every step of the runner until it fails or succeeds. The template will then take care// of hiding all but one of the steps to give the illusion of stepping through the input characters.  
func RenderRunner(regex, input string) {  
   newMyRegex := NewMyRegex(regex)  
   debugSteps := newMyRegex.DebugMatch(input)  
  
   var steps []Step  
   for _, step := range debugSteps {  
      steps = append(steps, Step{  
         Graph:      step.runnerDrawing,  
         InputSplit: threeSplitString(input, step.currentCharacterIndex),  
      })  
   }  
  
   renderTemplateToBrowser(runnerTemplate, TemplateData{  
      Steps: steps,  
      Regex: regex,  
   })  
}

  
// threeSplitString divides a string into three pieces on a given indexfunc threeSplitString(s string, i int) []string {  
   var left, middle, right string  
  
   left = s[:i]  
   if i < len(s) {  
      middle = string(s[i])  
      right = s[i+1:]  
   }  
  
   return []string{left, middle, right}  
}
```

All we're doing here is parsing the `debugSteps` from `DebugMatch` into data structures which our templates know what to do with. This includes breaking the input string into three pieces so that we can render the characters before the current character, the current character, and remaining characters in different ways.

To make this work, we just need a few template data structures, as well as the template itself.

```go
// templates.go
  
type TemplateData struct {  
   Steps []Step  
   Regex string  
   Input string  
}  
  
type Step struct {  
   Graph      string  
   InputSplit []string  
}  
  
const runnerTemplate = `  
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>  
<script>mermaid.initialize({startOnLoad:true});</script>  
<body onload="prev()">  
  
<h1>Regex: ({{ .Regex }})</h1>  
  
<div class="nav-buttons">  
   <button id="prev" onClick="prev()">      prev   </button>   <button id="next" onClick="next()">      next   </button>   <p>Or use the arrow keys to Step through the FSM</p></div>  
  
{{ range $i, $s := .Steps }}  
<div class="graph" {{ if ne $i 0 }} style="visibility:hidden;" {{ else }} style="visibility:visible" {{ end }}>  
   <p style='font-size:64px'>      <span style='color:red'>{{ index .InputSplit 0 }}</span><span style='text-decoration-color:red;text-decoration-line:underline;'>{{ index .InputSplit 1 }}</span><span>{{ index .InputSplit 2 }}</span>   </p>   <div class="mermaid">      {{ .Graph }}   </div></div>  
{{ end }}  
  
<script type="text/javascript">  
let i = 1  
  
function next() {  
  const c = document.getElementsByClassName('graph')  if (i >= c.length - 1) return   
   i++  
   for (let j = 0; j < c.length; j++) {      if (i != j)    {        c[j].style.display = 'none'        c[j].style.visibility = 'hidden'   
      } else {  
        c[j].style.display = 'block'        c[j].style.visibility = 'visible'      }    
   }  
}  
  
function prev() {  
   if (i <= 0) return   i--   const c = document.getElementsByClassName('graph')   for (let j = 0; j < c.length; j++) {  
      if (i != j)    {        c[j].style.display = 'none'        c[j].style.visibility = 'hidden'   
      } else {  
        c[j].style.display = 'block'        c[j].style.visibility = 'visible'      }    
   }  
}  
  
function checkKey(e) {  
   if (e.which === 37 || e.which === 40) {      prev()   } else if (e.which === 39 || e.which === 38) {      next()   }  }  
  
</script>  
<script>document.onkeydown = checkKey;</script>  
<div>  
</div>  
`
```

Again, I won't explain this because it's nasty Javascript and it's not too interesting. Let's just try it out and see what happens!

![abc-regex-demo.gif](/img/abc-regex-demo.gif)

Nice! The underlined character shows which character we're going to process next, and the letters in red are those already processed. The state in red shows the active state at any given moment.

So, we can look at the red state, ask ourselves "is there a transition which matches the character that's about to be processed?", and then we can predict which state will be active next!

Let's try another example.


![i-love-cats-regex-demo-fast.gif](/img/i-love-cats-regex-demo-fast.gif)

We can see that most of the characters make our FSM fail immediately. We know that the `runner` has failed because there is no active state for one step. It's at this point that our algorithm resets the runner and starts the search again from the next substring. 

It's only until we reach the `cats` substring that we begin to start matching `States` and can finally progress to the final end state and declare the match a success.

Let's take a look at one more example, this time with the regular expression `aab` with the input search string `"aaaab"`

![backtracking-regex-demo.gif](/img/backtracking-regex-demo.gif)

Notice what happens when we get from `State 0` to `State 2` and then fail? We have to go back a few steps in our input search string in order to search for other potential matches. This is called 'backtracking'. It's the result of the recursion in our  `match()` function, and it has serious performance implications for regex/search string combinations such as these. In these cases we have to backtrack the length of the regex on every failure. Not ideal.

I invite you to play around with different combinations and see what you can find. I found that this was of vizualising the algorithms we're using was very helpful in internalizing the characteristics. This becomes especially useful when our FSMs become more complex.

That's enough for visualizations for now, we can now move onto adding new features to our regex engine.

{{% notice tip %}} 
Check out this part of the project on GitHub [here](https://github.com/LeweyM/search/tree/master/src/v5)
{{% /notice %}} 