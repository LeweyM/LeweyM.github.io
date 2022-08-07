---
title: Regex Processor 3 Starting the compiler
draft: false
---
Now we have a working FSM and way to process strings, let's take a look at building FSMs automatically from regular expressions using a **compiler**.

### Compiling a Finite State Machine

We can break down the previous example of writing a FSM for the regular expression `abc` into a few at least 2 discrete steps;

1. take the string `abc` and create a linked list of `'states'` with conditional transitions to other states.
2. process the input and move through the states.

We'll call these steps `compile` and `evaluate`.

So far, we've only looked at the `evaluate` step where we take an already made FSM and process an input string by moving through its states. Now we'll look at the `compile` step.

`compile` in this context means turning a string of characters that represent a valid regular expression into a linked list of states; a finite state machine. For this we will create a `Compiler` struct with a `Compile` method which takes a string and returns a `*State`.

We can break the compile step down into three more steps;

1. lexing
2. parsing
3. compiling

Let's go through these 3 steps in detail.

### Lexing

Before we start turning strings into complex abstract objects, it helps to turn them into something a bit easier to work with. In the 'Lexing' stage, that's what we do. We simply convert the different types of characters into `tokens` which can be more easily interpretted by our program.

### Parsing

Once we have our `tokens`, we want to build something called an 'Abstract Syntax Tree' - or an `AST` for short. The `AST` is a tree which represents the *hierarchical relationship* of the regular expression. In other words, in this stage we describe the **structure** of the expression.

An example of the structure of regular expression `(ca(r|t)s)` might look like this;


