---
title: Regex Processor
draft: false
---
So, one of the things I've wanted to play around with is search and regex. Regex always seemed like a bit of a mystery to me, and then one day I watched a lecture on finite state machines and it opened up a thriving vein of curiosity to follow.

# Finite State Machines
finite state machines are super simple and super useful. The simplest definition I can think of is something like this;

> You start in some state, then you decide the next state to go to based on some input. After processing all the input, you see which state you're in. 

One of the cool things about FSMs is that they can be drawn as lovely little circles and arrows representing **states** and **transitions**

![Pasted image 20220119151322](/static/img/Pasted image 20220119151322.png)

This is the simplest. It's just a single state. The red circle in the middle means that we're currently in that state. It doesn't mean much yet.

![Pasted image 20220119151437](/static/img/Pasted image 20220119151437.png)

This is the next simplest. It's a two state system. From the state on the left, we'll call it `state[0]`, we travel to the state on the right, `state[1]`, if we process the character `c` from the input.

Two things to note here:
1. What happens if we process a different character to `c`? From the picture, we don't know what to do. To be truely accurate, there should be an arrow for every possible input, every character in this case. For brevity, we say that if there is no arrow, it means "go back to the starting state".
2. The circle on the right is blue. This means, this is an **end state**. If we arrive at this state, we have finished, and the FSM can return `true`.

All this is lovely and everything, but what can we actually do with this? We're going to use these machines to solve regular expressions.

## Text search

let's create a state machine which checks if a string matches against a simpe regular expression query `abc`. This means that any string containing the substring `abc` will match. For example: 
- `"zabcz"` - match
- `"abc"` - match
- `"abd"` - no match
- `""` - no match

The state machine to check for is as follows:

![Pasted image 20220119180620](/static/img/Pasted image 20220119180620.png)


let's break this down a bit. Really, each state is saying something.

State 0 is saying: "you have not yet seen anything interesting"
State 1 is saying: "you've just seen `'a'`"
State 2 is saying: "you've just seen `'ab'`"
State 3 is saying "you've just seen `'abc'` so you're done!"

let's get into these states and what they're saying a little more to try to understand all of these arrows.

At state 0, I still haven't seen anything interesting until I see an `'a'`, that's pretty straight forward.

At state 1, if I see another `'a'`, with the string `"aaabc"` for example, I still want to be in the state of "you've just seen `'a'`", therefore we need the little recursive arrow which points to itself.

At state 2 we're saying "you've just seen `'ab'`. If we've seen `ab` and we then see and `'a'`, we want our state to say "you've just seen `'a'`", rather than "you haven't seen anything interesting yet", so therefore we need another little arrow to go to state 1.

And at state 3, we know we've seen `'abc'`, so we don't want to do anything from here!


## Wildcards

cool, so what about a regular expression like `'a*b'`. This means "match any string that has an `'a'` followed by a `'b'`". What would the FSM look like for that?

![Pasted image 20220119183708](/static/img/Pasted image 20220119183708.png)

This is pretty straight forward, if you're at `state[1]`, that means "you've already seen `'a'`". Therefore, you never go back to the previous state. Then, if you've already seen `'a'` and you later see `'b'`, you're done!

Notice that this works for any number of chars between `a` and `b`, including zero.

## OR 

Consider a regular expression like `'dog|cat'`, which means "match any string containing the substring `dog` or the substring `cat`".

![Pasted image 20220119185302](/static/img/Pasted image 20220119185302.png)

Hmm, although the structure is the same, we're starting to see some complexity here. It looks like most of the complexity comes from the cross arrows running between the upper and lower states. Also, we need to remember in our regex for `"cat"` that if we process a `'c'` somewhere during the the states along `"cat"`, we need to go back to the "you've seen `'c'`" state instead of the beginning. In fact, most of the arrows point to the `'d'` and `'c'` states, the first letters of `cat` and `dog`. Let's think about how we can reduce some of the complexity here.

What's happening here is that we're trying to replicate how `grep` works, not how regular expressions work. A regular expression would just say "the string starts with "cat" or "dog", otherwise it doesn't match". Doing it this way simplifies our diagram quite a lot.

![Pasted image 20220128175219](/static/img/Pasted image 20220128175219.png)

We can still use this to get grep-like behaviour by simply resetting the finite state machine every time it lands in a "Failed" state (or a "Passed" state if we want to count multiple matches).

# Branches

This is all hunky-dory when we know exactly where to go in our finite state machine, but that's not always the case. Consider the regex `"dog|dot"`. We might draw our FSM like so:

![Pasted image 20220128175308](/static/img/Pasted image 20220128175308.png)

so, what happens when we come across our first 'd' character? Which way do we go? Having choices in our state machine makes into a Nondeterministic State Automata (NFA), and there's a load of study into these things, study I'm far too lazy to actually do. What I do know, however, is that we can still use these to solve regular expression problems.

I'm picking an easy way. Branching.

Basically, when I come across more than one path in my state machine, the runner (the little red dot in our pictures) will split in two and go down both paths. If one of the runners reaches a success state, it's a match. If all runners enter a fail state, no match. This does sacrifice some performance as we can no longer guarantee the finite state machine to determine a match in linear time, but it does make our diagrams simpler, which is good enough for now.

![Pasted image 20220128180045](/static/img/Pasted image 20220128180045.png)

![Pasted image 20220128180055](/static/img/Pasted image 20220128180055.png)

![Pasted image 20220128180104](/static/img/Pasted image 20220128180104.png)

![Pasted image 20220128180114](/static/img/Pasted image 20220128180114.png)