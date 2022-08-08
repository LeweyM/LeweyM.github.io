---
title: Regex Processor 3 Starting the compiler
draft: false
---
Now we have a working FSM and way to process strings, let's take a look at building FSMs automatically from regular expressions using a **compiler**.

### Compiling a Finite State Machine

We can break down the previous example of writing an FSM for the regular expression `abc` into  at least 2 discrete steps;

1. Take the string `abc` and create a linked list of `'states'` with conditional transitions to other states.
2. Process the input by moving through the states.

We'll call these steps `compile` and `evaluate` respectively.

So far, we've only looked at the `evaluate` step, where we take an already made FSM and process an input string by moving through its states. Now we'll look at the `compile` step.

`compile` in this context, means turning a string of characters that represent a valid regular expression into a linked list of states; a finite state machine. For this, we will create a `Compiler` struct with a `Compile` method which takes a string and returns a `*State` representing the first `State` of the FSM, the `root` or `head` `State`.

Let's do even more decomposition of this problem and break the compilation step into three phases;

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

This tree shows the relationship between a `group` (whatever is inside the parenthesis) and the three `char` literals which make up the expression `cat`. To simplify things, we're going to imagine that all regular expressions exist inside a top-level `group`, so `cat` is equivalent to `(cat)`. 

This hierarchy can become more complicated when things like nested groups or `branches` are involved. For example, the `AST` for `(ca(r|t)s)` looks like this;

![Pasted-image-20220807173959.png](/img/Pasted-image-20220807173959.png)

The important thing to know about this step is that here we are describing the **structure** of the expression, and that this structure is **recursive**. We can isolate any node and process its children, without needing knowledge from elsewhere in the tree. In other words, each **subtree** can be treated in the same way as the **tree**, which is very useful in reducing complexity. 

Having this structure will make our lives a lot easier in the next step.

### Compile

Here, we actually build the `States` from the `AST` we created in the previous step.

The end result should be a linked list of `States` which should represent our regular expression, and a reference to the root `State`. The way we produce this from our `AST` is by asking each node to produce an FSM, which will in-turn ask any child nodes to produce an FSM and compose them together, until we reach the leaf nodes - which have no children - and the process ends.

This is where we see the power of recursive structures, as each node must produce an FSM, but nested structures don't need to know anything about how their children produce FSMs - in fact those children might be nested structures themselves. This is a very powerful and flexible concept, and very useful for what we're trying to do now.

Now that we've described our three phases, let's jump into some code.

### Coding the lexer

In this implementation, we're going to support a subset of regex special characters;

```
().*?+|
```

For simplicity, we're not going to support escaped characters such as `\?`. Any character not in the set above is to be considered a literal character.

Let's define these as `symbols`.

```
type symbol int

const (
	AnyCharacter symbol = iota
	Pipe
	LParen
	RParen
	Character
	ZeroOrMore
	OneOrMore
	ZeroOrOne
)
```

Using these `symbols`, we can create a `token` struct which contains information on the type of symbol, and the character itself, if necessary.

```
type token struct {  
   symbol symbol  
   letter rune  
}
```

Now we simply need to loop through the regular expression string and map the characters to our tokens.

```
func lex(input string) []token {  
   var tokens []token  
   i := 0  
   for i < len(input) {  
      tokens = append(tokens, lexRune(rune(input[i])))  
      i++  
   }  
   return tokens  
}  
  
func lexRune(r rune) token {  
   var s token  
   switch r {  
   case '(':  
      s.symbol = LParen  
   case ')':  
      s.symbol = RParen  
   case '.':  
      s.symbol = AnyCharacter  
   case '|':  
      s.symbol = Pipe  
   case '*':  
      s.symbol = ZeroOrMore  
   case '+':  
      s.symbol = OneOrMore  
   case '?':  
      s.symbol = ZeroOrOne  
   default:  
      s.symbol = Character  
      s.letter = r  
   }  
   return s  
}
```

That's really all there is to it. Now instead of a string of characters, we have our own defined `tokens` to work with.

Now we'll use those `tokens` to build our `AST`

### Coding the parser



// for compiler coding stage

The trick to keeping this step simple (and it can very quickly become **not** simple) is to let each node of the `AST` decide how it should be compiled.

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

Let's look at this visually for our example of `abc`

![Pasted-image-20220807181511.png](/img/Pasted-image-20220807181511.png)

The `group` contains three `characterLiteral` nodes, compiled into their two `State` form. We begin by merging the states from left to right. This means taking the tail of the first FSM and merging it with the head of the second FSM.

![Pasted-image-20220807181731.png](/img/Pasted-image-20220807181731.png)

Which leaves us with;

![Pasted-image-20220807181749.png](/img/Pasted-image-20220807181749.png)

We can repeat this process of merging the tail of the left-most FSM with the head of the second FSM until we are left with a single, compiled FSM.

![Pasted-image-20220807181855.png](/img/Pasted-image-20220807181855.png)

![Pasted-image-20220807181901.png](/img/Pasted-image-20220807181901.png)

And there we have it, a successfully compiled state machine!

### The power of structure

Here, I hope it starts to become clear why we separate the `compiling` from the `lexing` and `parsing` stages. Once we have the **structure** of the expression, it's much easier to decompose the compilation into leaf nodes, such as a single letter, and composing nodes which hold collections of other nodes. Once we have these two types, we can simply tell composing nodes how to group their children, and tell leaf nodes the expected compiled form. 

Having this separation of concerns will make life a lot easier for use when we introduce more complicated structures.

