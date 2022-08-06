---
title: Regex Processor
draft: false
---
So, one of the things I've wanted to play around with is search and regex. Searching through text for matches to a regular expression can be efficiently implemented using **finite state machines**.

# Finite State Machines
finite state machines are both simple and useful. The simplest definition I can think of is something like this;

> A finite State Machine (FSM) is a series of states. The machine start in some state, then decides the next state to go to based on some input. 

One of the cool things about FSMs is that they can be drawn as lovely little circles and arrows representing **states** and **transitions**:

![Pasted-image-20220119151322.png](/img/Pasted-image-20220119151322.png)

This is the simplest. It's just a single state. The red circle in the middle means that we're currently in that state, although that doesn't tell us much yet...

For this to be useful, we need more than one state.


![Pasted-image-20220119151437.png](/img/Pasted-image-20220119151437.png)

This a two state system. Starting from the state on the left - we'll call it `state[0]` - we travel to the state on the right - `state[1]` - only if we see the character `c`.

Two things to note here:
1. What happens if we process a different character to `c`, such as `z`? From the picture, we don't know what to do as there is no arrow for the `z` case. To be truly accurate, we would need to have an arrow for every possible character. For brevity, let's say that if there is no arrow, there was no match.
2. The circle on the right is blue. This means this is an **end state**. If we arrive at this state we have finished and a match has been found.

This is all lovely, but what can we actually do with this? We're going to use these machines to solve regular expressions.

## Text search

let's create a state machine which checks if a string matches against a simple regular expression query `abc`. This means that any string containing the substring `abc` will match. For example: 
- `"zabcz"` -> match
- `"abc"` -> match
- `"abd"` -> no match
- `""` -> no match

The finite state machine which represents this regular expression is as follows:

![Pasted-image-20220710201842.png](/img/Pasted-image-20220710201842.png)

let's break this down a bit. Really, each state is saying something.

State 0 is saying: "you have not yet seen anything interesting"
State 1 is saying: "you've just seen `'a'`"
State 2 is saying: "you've just seen `'ab'`"
State 3 is saying "you've just seen `'abc'` so you're done!"

let's get into these states and what they're saying a little more to try to understand all of these arrows.

At state 0, I still haven't seen anything interesting until I see an `'a'`, that's pretty straight forward.

At state 1, I know that the first character I saw as `'a'`

![Pasted-image-20220710202102.png](/img/Pasted-image-20220710202102.png)

At state 2 we're saying "you've just seen `'ab'`.

![Pasted-image-20220710202144.png](/img/Pasted-image-20220710202144.png)

And at state 3, we know we've seen `'abc'`, so we don't want to do anything from here!

![Pasted-image-20220710202159.png](/img/Pasted-image-20220710202159.png)

That's really all there is to it. The interesting thing is how we can combine arrows and circles to create FSM that can represent complex regular expressions.

## Getting into some code

### The FSM data structure
We can first think about our core data structures to represent the FSM. The FSM is essentially a linked list of `state` objects.

```
type State struct {  
	connectedStates []State  
}
```

We need a bit more information, however, as we need to know which character allows us to go from one state to another. We'll use a `Transition` struct to represent this.

The `Transition` struct contains two things:
1. the next state
2. the predicate that determines whether we can go to the next state

```
type Transition struct {  
   // to: a pointer to the next state   
   to *State  
   // predicate: a function to determine if we should move to the next state
   predicate func(input rune) bool  
}  
```

The `Predicate` is a simple function that takes in a character (here we're using `rune` to avoid multi-byte character issues).

```
type Predicate func(input rune) bool
```

Putting that together;

```
type Predicate func(input rune) bool
  
type Transition struct {  
   to          *State  
   predicate   Predicate  
}  
  
type State struct {  
   transitions []Transition  
}

```

### Running Our State machine

Inorder to use our state machine, we'll need something that can process a string by running through the states, and that can give information on matches. As this is an object that runs through our state machine, we'll call this a **Runner**.

```
type runner struct {  
   head      *State  
}
```

For now, all our runner needs to have is a pointer to the root (or `head`) node of our FSM.

### Tests first

We'll be following TDD principles when convenient in order to make sure things are working as expected (and because, personally, I find it more fun). As we now have our fundamental objects mapped out, we can now start writing some tests.

Our first test will check the behaviour of a simple FSM which represents the regex expression `abc`. The first thing to do is contruct the FSM. We'll do this 'by hand' for now, and later we'll work on a **compiler** that can take a string like `"abc"` and build an FSM automatically.

```
func TestHandmadeFSM(t *testing.T) {
	startState := State{}  
	stateA := State{}  
	stateB := State{}  
	stateC := State{}  
	  
	startState.transitions = append(startState.transitions, Transition{  
	   to:          &stateA,  
	   predicate:   func(input rune) bool { return input == 'a' },  
	})  
	  
	stateA.transitions = append(stateA.transitions, Transition{  
	   to:          &stateB,  
	   predicate:   func(input rune) bool { return input == 'b' },  
	})  
	  
	stateB.transitions = append(stateB.transitions, Transition{  
	   to:          &stateC,  
	   predicate:   func(input rune) bool { return input == 'c' },  
	})
}
```

There's quite a bit going on here, so let's break it down a bit.

First, let's remind ourselves of the FSM structure for the regex `abc`

![Pasted-image-20220710201842.png](/img/Pasted-image-20220710201842.png)

There are 4 states which we have to define first.

```
	startState := State{}  
	stateA := State{}  
	stateB := State{}  
	stateC := State{} 
```

Once we have our states, we need to describe the transitions between them. The first is the transition from the `startState` to `stateA`. To do this, we simply append a `Transition` object to the `transitions` property of `startState`. This new transition must point to `stateA`, and take as it's predicate a function that returns `true` if the input rune is `'a'`. 

```
startState.transitions = append(startState.transitions, Transition{  
   to:          &stateA,  
   predicate:   func(input rune) bool { return input == 'a' },  
})  
```

Same goes for the remaining states.

```
	stateA.transitions = append(stateA.transitions, Transition{  
	   to:          &stateB,  
	   predicate:   func(input rune) bool { return input == 'b' },  
	})  
	  
	stateB.transitions = append(stateB.transitions, Transition{  
	   to:          &stateC,  
	   predicate:   func(input rune) bool { return input == 'c' },  
	})
```

We now have our first FSM starting at the root node `startState`. Let's write a test which creates a `runner` and uses this FSM to check against a few different input cases.

The outcome of running a string through an FSM should result in one of 3 statuses;
1. `Normal`. The FSM has not found a match yet, but neither has it found that there is no match. Another way of saying this is that the search is still 'in progress'.
The cases we want to test are;
2. `Success`. The FSM has found a match.
3. `fail`. The FSM has found that the string does not match.

We can define these as consts of a specific type.

```
type Status string  
  
const (  
   Success Status = "success"  
   Fail           = "fail"  
   Normal         = "normal"  
)
```

With that in mind we can think of a few cases to test our FSM and runner logic;

`""` -> `normal`
`"x"` -> `fail`
`"abc"` -> `success` 
`"ab"` -> `normal` 

Writing these up into table-style tests we get the following;

```
type test struct {  
   name           string  
   input          string  
   expectedStatus Status  
}  
  
tests := []test{  
   {"empty string", "", Normal},  
   {"non matching string", "x", Fail},  
   {"matching string", "abc", Success},  
   {"partial matching string", "ab", Normal},  
}
```

The actual tests should simply create a runner using our hand-made FSM, iterate through the runes in the `input` string, and check that the `Status` of the runner is the same as our expected status.

```
for _, tt := range tests {  
   t.Run(tt.name, func(t *testing.T) {  
      testRunner := NewRunner(&startState)  
  
      for _, character := range tt.input {  
         testRunner.Next(character)  
      }  
  
      result := testRunner.getTotalState()  
      if tt.expectedStatus != result {  
         t.Fatalf("Expected FSM to have final state of '%v', got '%v'", tt.expectedStatus, result)  
      }  
   })  
}
```

Notice that we had to invent a couple of methods to make this work, such as the `NewRunner`, `testRunner.Next` and `testRunner.getStatus`. This is fine, as we'll come back to implementing these in a moment. 

All together, our first test looks like this;

```
func TestHandmadeFSM(t *testing.T) {  
   // hand-made FSM
   startState := State{}  
   stateA := State{}  
   stateB := State{}  
   stateC := State{}  
  
   startState.transitions = append(startState.transitions, Transition{  
      to:        &stateA,  
      predicate: func(input rune) bool { return input == 'a' },  
   })  
  
   stateA.transitions = append(stateA.transitions, Transition{  
      to:        &stateB,  
      predicate: func(input rune) bool { return input == 'b' },  
   })  
  
   stateB.transitions = append(stateB.transitions, Transition{  
      to:        &stateC,  
      predicate: func(input rune) bool { return input == 'c' },  
   })  
  
   type test struct {  
      name           string  
      input          string  
      expectedStatus Status  
   }  
  
   tests := []test{  
      {"empty string", "", Normal},  
      {"non matching string", "x", Fail},  
      {"matching string", "abc", Success},  
      {"partial matching string", "ab", Normal},  
   }  
  
   for _, tt := range tests {  
      t.Run(tt.name, func(t *testing.T) {  
         testRunner := NewRunner(&startState)  
  
         for _, character := range tt.input {  
            testRunner.Next(character)  
         }  
  
         result := testRunner.getTotalState()  
         if tt.expectedStatus != result {  
            t.Fatalf("Expected FSM to have final state of '%v', got '%v'", tt.expectedStatus, result)  
         }  
      })  
   }  
}

```

### Compiling a Finite State Machine

We can break down the previous example of writing a FSM for the regular expression `abc` into a few at least 2 discrete steps;

1. take `abc` and create a linked list of `'states'` with conditional transitions to other states.
2. process the input and move through the states.

We'll call these steps `compile` and `evaluate`.

`compile` means turning a string of characters that represent a valid regular expression into a linked list of states; a finite state machine. For this we will create a `Compiler` struct with a `Compile` method which takes a string and returns a `*State`.




(? too early for this?)
There are many ways of making compilers, but the one we're going to look at uses a stack as it's main data structure.




