---
title: Regex Processor 3 Starting the compiler
draft: false
---
Now we have a working FSM and way to process strings, let's take a look at building FSMs automatically from regular expressions using a **compiler**.

### Compiling a Finite State Machine

We can break down the previous example of writing a FSM for the regular expression `abc` into a few at least 2 discrete steps;

1. take `abc` and create a linked list of `'states'` with conditional transitions to other states.
2. process the input and move through the states.

We'll call these steps `compile` and `evaluate`.

`compile` means turning a string of characters that represent a valid regular expression into a linked list of states; a finite state machine. For this we will create a `Compiler` struct with a `Compile` method which takes a string and returns a `*State`.




(? too early for this?)
There are many ways of making compilers, but the one we're going to look at uses a stack as it's main data structure.




