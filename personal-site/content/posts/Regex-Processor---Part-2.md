---
title: Regex Processor - Part 2
draft: false
---
## One or more

cool, so what about a regular expression like `'a+b'`? 

This means "match any string that has **one or more** `'a'`s, followed by a `'b'`". So, for example: 

- `"ab"` -> match
- `"aaaaab"` -> match
- `"ba"` -> no match
- `""` -> no match

What would the FSM look like for that? Well, it would look like the following;

![Pasted-image-20220710203421.png](/img/Pasted-image-20220710203421.png)

This is pretty straight forward, if you're at `state[1]`, that means "you've already seen `'a'`". If you see `'a'` again, stay in the same state. If you've already seen `'a'` at least once, and you then see `'b'`, you're done!

Let's walk through this with an example of `aab`, which we expect to match.

We start off at `state[0]`, before we have processed any of the input.

![Pasted-image-20220710203429.png](/img/Pasted-image-20220710203429.png)

The first letter we process is `'a'`, so we move to `state[1]`.

![Pasted-image-20220710203603.png](/img/Pasted-image-20220710203603.png)

The next letter we process is another `'a'`, so we stay in the same state.

![Pasted-image-20220710203442.png](/img/Pasted-image-20220710203442.png)

And finally we process `b`, so we move to `state[3]`.

![Pasted-image-20220710203508.png](/img/Pasted-image-20220710203508.png)

As `state[3]` is an end state, we can finish here and declare that a match was found!
