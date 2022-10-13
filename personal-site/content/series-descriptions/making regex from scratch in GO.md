---
title: making regex from scratch in GO
image: img/Pasted-image-20221013103011.png
seriesdesc: ["making regex from scratch in GO"]
---
This series is a step by step guide to creating an (almost) fully fledged Regex engine using Go. It explores the basics of Finite State Automata, incrementally creates a parser and compiler for turning strings into state machines, walks through the setup of a visualizer for the FSM node graph. All of the development is structured as a TDD project, and uses modern Go features such as fuzzing, generics, and profiling.