---
title: 11 Reducing Epsilon NFA to NFA
draft: false
series: ["making regex from scratch in GO"]
---

## Reducing Epsilon NFA to NFA

Having spent so long building up state machines using epsilon transitions, it now seems slightly perverse that we're going to spend this chapter ripping them out! However, we're still going to use them to compose our regular expression FSMs. The idea is to compose using epsilons, because it's easier, and then **reduce** the epsilon-NFA to a normal NFA.

The benefits of doing so are mainly for performance, although we haven't been particularly performance conscious up until now, and there are plenty of optimisations we could make before this one. The performance benefits come from not having to traverse the set of states connected by epsilons. One way of thinking of this optimisation is that we cache those set of states so that they don't have to be traversed every time.

## Some preparatory code changes

Before we get stuck in, there are a few changes we have to make to our code.

First, it's finally time to give up our hack of using the last state as the success state. The technique we're going to use means that this is not true in all cases, so we need a way of keeping track of which states should be considered success states. 

The simplest way I can think of is a flag on the `State` struct for this.

```diff
@@ // state.go

 type State struct {
        transitions []Transition
        epsilons    []*State
+       success     bool
 }
```

This simplifies our `isSuccessState() bool` method, as we no longer need to check its transitions.

```diff
@@ // state.go

 func (s *State) isSuccessState() bool {
-       if len(s.transitions) == 0 && len(s.epsilons) == 0 {
-               return true
-       }
-
-       return false
+       return s.success
 }
```

And now we just need a simple method to turn a state into a success state.

```go
// state.go

func (s *State) SetSuccess() {
    s.success = true
}
```

Now let's use our new setter method. We'll need it in our `myRegex` struct, and also in our `draw_test` methods.

```diff
@@ // regex.go

func NewMyRegex(re string) *myRegex {
        tokens := lex(re)
        parser := NewParser(tokens)
        ast := parser.Parse()
        state, _ := ast.compile()
+       endState.SetSuccess()

        return &myRegex{fsm: state}
 }
```

```diff
@@ // draw_test.go

func abcBuilder() *State {
        state1.addTransition(state2, Predicate{allowedChars: "a"}, "a")
        state2.addTransition(state3, Predicate{allowedChars: "b"}, "b")
        state3.addTransition(state4, Predicate{allowedChars: "c"}, "c")
+       state4.SetSuccess()
        return state1
 }

func aaaBuilder() *State {
        state1.addTransition(state2, Predicate{allowedChars: "a"}, "a")
        state2.addTransition(state3, Predicate{allowedChars: "a"}, "a")
        state3.addTransition(state4, Predicate{allowedChars: "a"}, "a")
+       state4.SetSuccess()
        return state1
 }

func aεbBuilder() *State {
        state1.addTransition(state2, Predicate{allowedChars: "a"}, "a")
        state2.addEpsilon(state3)
        state3.addTransition(state4, Predicate{allowedChars: "b"}, "b")
+       state4.SetSuccess()
        return state1
 }
```

Lovely, everything should be green again!

## Adding flags to our command line tool

We want the ability to apply flag arguments to our commands. Flag arguments are prefixed with `--` and they can be used in any order. This is unlike arguments we've used until now, which have a fixed order. For example, in the command `draw "abc" "a"`, the arguments `draw`, `"abc"`, and `"a"` are all defined by their order. We could also describe the command as `{command} {regex} {search-string}`.[^posargs]
[^posargs]: Command line arguments which depend on the order are known as **positional arguments**.

Let's add a data structure for flags.

```go
// main.go

type CmdFlag string
```

This should be enough for now. We just need a set of `CmdFlags`, which are a special type built on top of simple `strings`. The only flag we'll need now is the one which enabled epsilon reduction, so let's add that.

```go
// main.go

const reduceEpsilon CmdFlag = "reduce-epsilon"
```

Now let's add these to our main function.

```diff
@@ // main.go

 // Main just used for linking up the main functions
 func Main(args []string) {
+       args, flags := parseArgumentsAndFlags(args)
+
        switch args[0] {
        case "draw":
                if len(args) == 2 {
-                       RenderFSM(args[1])
+                       RenderFSM(args[1], flags)
                } else if len(args) == 3 {
-                       RenderRunner(args[1], args[2])
+                       RenderRunner(args[1], args[2], flags)
                }
        case "out":
                if len(args) == 4 {
-                       OutputRunnerToFile(args[1], args[2], args[3])
+                       OutputRunnerToFile(args[1], args[2], args[3], flags)
                }
        default:
                panic("command not recognized")
		}
 }

 // RenderFSM will render just the finite state machine, and output the result to the browser
-func RenderFSM(input string) {
+func RenderFSM(input string, flags Set[CmdFlag]) {
        graph := NewMyRegex(input).DebugFSM()
        html := buildFsmHtml(graph)
        outputToBrowser(html)
 }

 // RenderRunner will render every step of the runner until it fails or succeeds. The template will then take care
 // of hiding all but one of the steps to give the illusion of stepping through the input characters. It will
 // then output the result to the browser.
-func RenderRunner(regex, input string) {
+func RenderRunner(regex, input string, flags Set[CmdFlag]) {
        htmlRunner := buildRunnerHTML(data)
        outputToBrowser(htmlRunner)
 }

 // OutputRunnerToFile will render every step of the runner, the same as RenderRunner, and then write the html to
 // a file.
-func OutputRunnerToFile(regex, input, filePath string) {
+func OutputRunnerToFile(regex, input, filePath string, flags Set[CmdFlag]) {
        data := buildRunnerTemplateData(regex, input)
        htmlRunner := buildRunnerHTML(data)
        outputToFile(htmlRunner, filePath)
 }
```

Here, we're simply passing the `flags` variable, which is of type `Set[CmdFlag]`, to our three output functions, `RenderFSM`, `RenderRunner`, and `OutputRunnerToFile`. Currently, we do nothing with it (we'll fix that later). 

The `flags` variable comes from the `parseArgumentsAndFlags(args)` method. Let's implement that now.

```go
// main.go

func parseArgumentsAndFlags(args []string) ([]string, Set[CmdFlag]) {  
   flagSet := NewSet[CmdFlag]()  
   var arguments = []string{}  
   for _, arg := range args {  
      switch arg {  
      case "--reduce-epsilons":  
         flagSet.add(reduceEpsilon)  
      default:  
         if strings.HasPrefix(arg, "--") {  
            panic(fmt.Sprintf("flag '%s' not recognized", arg))  
         }  
         arguments = append(arguments, arg)  
      }  
   }  
   return arguments, flagSet  
}
```

This is simple enough. We add any flag arguments to our `flagSet`, other arguments are appended to the list of normal arguments, and if we receive any `--` flags which we don't recognise, we panic. This is where we'll add any other flags we want to introduce to our system.

Now we're ready to add to start reducing.

## Reducers

We're going to add a new concept to our program; a **Reducer**. A Reducer is an object which takes an FSM and modifies it. The modified FSM will have been reduced in some way which is opaque to the outside - our components will know how to use a reducer, but not how it works.

We can implement this as an interface. [^packages]
[^packages]: In Go, unlike most languages which use interfaces, the interface is defined by the consumer, rather than the implementer. Because of this, I've chosen to define this interface in the `regex.go` file. In the project repository, all of the examples are defined in the same package, so only one definition of the interface is required. If we were spreading our program across different packages, as most Go projects do, we would write this interface everywhere that it is consumed. Although this seems like unnecessary repetition, it's actually very useful, as it allows the consumer to only define the parts of the required object necessary to carry out its specific task. If the interface were centrally defined by the implementer, the consumer would be obliged to know everything about the whole interface.  

```go
// regex.go

type Reducer interface {  
   reduce(s *State)  
}
```

We now simply have to apply one or more Reducer to our FSM.

```diff
@@ // regex.go

-func NewMyRegex(re string) *myRegex {
+func NewMyRegex(re string, reducers ...Reducer) *myRegex {
        tokens := lex(re)
        parser := NewParser(tokens)
        ast := parser.Parse()
+       state, endState := ast.compile()
+       for _, reducer := range reducers {
+               reducer.reduce(state)
+       }
+
        return &myRegex{fsm: state}
 }
```



{{% notice tip %}} 
Check out this part of the project on GitHub [here](https://github.com/LeweyM/search/tree/master/src/v10)
{{% /notice %}} 