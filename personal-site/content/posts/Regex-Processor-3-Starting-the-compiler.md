---
title: Regex Processor 3 Starting the compiler
draft: false
---
Now we have a working FSM and way to process strings, let's take a look at building FSMs automatically from regular expressions using a **compiler**.

### Compiling a Finite State Machine

We can break down the previous example of writing an FSM for the regular expression `abc` into  at least 2 discrete steps;

1. Take the string `abc` and create a linked list of `'states'` with conditional transitions to other states.
2. Process the input and move through the states.

We'll call these steps `compile` and `evaluate`.

So far, we've only looked at the `evaluate` step, where we take an already made FSM and process an input string by moving through its states. Now we'll look at the `compile` step.

`compile` in this context, means turning a string of characters that represent a valid regular expression into a linked list of states; a finite state machine. For this, we will create a `Compiler` struct with a `Compile` method which takes a string and returns a `*State`.

We can break the compile step down into three more steps;

1. lexing
2. parsing
3. compiling

Let's go through these 3 steps in detail.

### Lexing

Before we start turning strings into complex abstract objects, it helps to turn them into something a bit easier to work with. In the 'Lexing' stage, that's what we do. We simply convert the different types of characters into `tokens` which can be more easily interpreted by our program.

### Parsing

Once we have our `tokens`, we want to build something called an 'Abstract Syntax Tree' - or an `AST` for short. The `AST` is a tree which represents the *hierarchical relationship* of the regular expression. In other words, in this stage we describe the **structure** of the expression.

An example of the structure of regular expression `(cat)` might look like this;

![Pasted-image-20220807173722.png](/img/Pasted-image-20220807173722.png)

This tree shows the relationship between a `group` (whatever is inside the parenthesis) and the three `char` literals which make up the expression `cat`. This hierarchy can become more complicated when things like nested groups or `branches` are involved. For example, the `AST` for `(ca(r|t)s)` looks like this;

![Pasted-image-20220807173959.png](/img/Pasted-image-20220807173959.png)

The important thing to know about this step is that here we are describing the **structure** of the expression - this will make our lives a lot easier in the next step.

### Compile

Here, we actually build the `States` from the `AST` we created in the previous step.

The trick to keeping this step simple (it can very quickly become **not** simple) is to let each node of the `AST` decide what it should compile to. 

For our simple example of compiling the regular expression `abc`, we just need two types of `AST` node;

1. `CharacterLiteral`
2. `Group`

We saw these in the diagram above as 'group' and 'char' boxes. Let's go through them.

1. `CharacterLiteral`

The `CharacterLiteral` node represents a single character. It does not contain any inner nodes, so it is a leaf node of the `AST`.

Compiling a `CharacterLiteral` node is fairly straight forward. A character literal for the expression `a` should look like this;

![Pasted-image-20220807175929.png](/img/Pasted-image-20220807175929.png)

That's really all there is to it. It's a two `State` system with a single transition between them, using the character of the `CharacterLiteral` as the transition predicate.

2. `Group`

The `Group` node represents a collection of `AST` nodes which need to appear consecutively in the input string. For example, `abc` would be a `Group` of 3 `CharacterLiteral` nodes. The inner nodes of `Group` do not have to be `CharacterLiterals`, however. For example, `(()()())` would be a `Group` of 3 `Group` nodes.

Compiling a `Group` node is a case of merging together it's child nodes so that the last state of one child is merged with the first state of the next child. 