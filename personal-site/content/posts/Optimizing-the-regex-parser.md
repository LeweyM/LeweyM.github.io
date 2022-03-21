---
title: Optimizing the regex parser
draft: true
---
before

![Pasted-image-20220212160121.png](/img/Pasted-image-20220212160121.png)

![Pasted-image-20220212160132.png](/img/Pasted-image-20220212160132.png)

![Pasted-image-20220212160154.png](/img/Pasted-image-20220212160154.png)

![Pasted-image-20220212160229.png](/img/Pasted-image-20220212160229.png)

![Pasted-image-20220212160309.png](/img/Pasted-image-20220212160309.png)

```
... Searching       2    696948604 ns/op
```
```
➜  search git:(master) ✗ go test -bench=BenchmarkList -cpuprofile p.out                     
➜  search git:(master) ✗ go tool pprof -http localhost:8080 --nodecount=20 search.test p.out

```

now a memory profile

![Pasted-image-20220212160501.png](/img/Pasted-image-20220212160501.png)

![Pasted-image-20220212160526.png](/img/Pasted-image-20220212160526.png)

![Pasted-image-20220212160544.png](/img/Pasted-image-20220212160544.png)

![Pasted-image-20220212160638.png](/img/Pasted-image-20220212160638.png)

![Pasted-image-20220212160655.png](/img/Pasted-image-20220212160655.png)

![Pasted-image-20220212160715.png](/img/Pasted-image-20220212160715.png)

![Pasted-image-20220212160732.png](/img/Pasted-image-20220212160732.png)

now with tracing

![Pasted-image-20220212171700.png](/img/Pasted-image-20220212171700.png)

noticing a growth in go routines and heap allocation


after change:

```
func FindAllAsync(ctx context.Context, finiteStateMachine Machine, searchString string, out chan Result) {  
   defer close(out)  
   lineCounter := 0  
 start := 0  
 end := 0  
 runes := append([]rune(searchString), 0) // we add a 'NULL' 0 rune at the End so that even empty string inputs are processed.  
 hasRerunFail := false  
 for end < len(runes) {  
      select {  
      case <-ctx.Done():  
         return  
 default:  
         processRune(runes, end, lineCounter, finiteStateMachine, out, start, hasRerunFail)  
      }  
   }  
}
```

![Pasted-image-20220212172515.png](/img/Pasted-image-20220212172515.png)

```
... SearchingBenchmarkList-8   	       4	 280088490 ns/op
```

![Pasted-image-20220212172957.png](/img/Pasted-image-20220212172957.png)

![Pasted-image-20220212173115.png](/img/Pasted-image-20220212173115.png)
![Pasted-image-20220212173142.png](/img/Pasted-image-20220212173142.png)





simple optimization

```
func BenchmarkCompiler(b *testing.B) {  
   for i := 0; i < b.N; i++ {  
      Compile("abc*.(cat|dog)hello(ad(dc))") // ~3200 ns/op  
 }  
}
```

```
BenchmarkCompiler-8   	  356442	      3275 ns/op
```

![Pasted-image-20220213084104.png](/img/Pasted-image-20220213084104.png)

concat string doing alot of work

```
// concatenation  
case Character:  
   s1 := s.pop()  
   s2Tail := tail(s1)  
   next := &StateLinked{}  
   s.append(s2Tail, next, func(r rune) bool { return r == symbol.letter }, "to -> "+string(symbol.letter))  
   s.push(s1)
```

```
s.append(s2Tail, next, func(r rune) bool { return r == symbol.letter }, getDescription(symbol))
```

```
func getDescription(symbol symbol) string {  
   var desc string  
 if DEBUG {  
      desc = fmt.Sprintf("to -> %d", symbol.letter)  
   } else {  
      desc = "to -> letter"  
 }  
   return desc  
}
```

```
BenchmarkCompiler-8   	  409524	      2492 ns/op
```

![Pasted-image-20220213084331.png](/img/Pasted-image-20220213084331.png)