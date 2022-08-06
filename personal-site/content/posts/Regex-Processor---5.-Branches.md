---
title: Regex Processor - 5. Branches
draft: false
---
## OR 

Consider a regular expression like `'dog|cat'`, which means "match any string containing the substring `dog` or the substring `cat`".

![Pasted-image-20220119185302.png](/img/Pasted-image-20220119185302.png)

Hmm, although the structure is the same, we're starting to see some complexity here. It looks like most of the complexity comes from the cross arrows running between the upper and lower states. Also, we need to remember in our regex for `"cat"` that if we process a `'c'` somewhere during the the states along `"cat"`, we need to go back to the "you've seen `'c'`" state instead of the beginning. In fact, most of the arrows point to the `'d'` and `'c'` states, the first letters of `cat` and `dog`. Let's think about how we can reduce some of the complexity here.

What's happening here is that we're trying to replicate how `grep` works, not how regular expressions work. A regular expression would just say "the string starts with "cat" or "dog", otherwise it doesn't match". Doing it this way simplifies our diagram quite a lot.

![Pasted-image-20220128175219.png](/img/Pasted-image-20220128175219.png)

We can still use this to get grep-like behaviour by simply resetting the finite state machine every time it lands in a "Failed" state (or a "Passed" state if we want to count multiple matches).

### Branches

This is all hunky-dory when we know exactly where to go in our finite state machine, but that's not always the case. Consider the regex `"dog|dot"`. We might draw our FSM like so:

![Pasted-image-20220128175308.png](/img/Pasted-image-20220128175308.png)

so, what happens when we come across our first 'd' character? Which way do we go? Having choices in our state machine makes into a Nondeterministic State Automata (NFA), and there's a load of study into these things, study I'm far too lazy to actually do. What I do know, however, is that we can still use these to solve regular expression problems.

I'm picking an easy way. Branching.

Basically, when I come across more than one path in my state machine, the runner (the little red dot in our pictures) will split in two and go down both paths. If one of the runners reaches a success state, it's a match. If all runners enter a fail state, no match. This does sacrifice some performance as we can no longer guarantee the finite state machine to determine a match in linear time, but it does make our diagrams simpler, which is good enough for now.

![Pasted-image-20220128180045.png](/img/Pasted-image-20220128180045.png)

![Pasted-image-20220128180055.png](/img/Pasted-image-20220128180055.png)

![Pasted-image-20220128180104.png](/img/Pasted-image-20220128180104.png)

![Pasted-image-20220128180114.png](/img/Pasted-image-20220128180114.png)