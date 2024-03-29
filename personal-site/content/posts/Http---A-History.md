---
title: Http - A History
draft: false
---
A few notes based on this [great video ](https://www.youtube.com/watch?v=ai8cf0hZ9cQ&t=536s)

## HTTP/1
### TCP/IP
The first and most simple approach, making a TCP handshake for each resource which has to be shared.

The downsides to this approach is that in order to speed up transfer rates, we want to send many resource pieces in parallel. With HTTP/1, this means doing a new TCP handshake every-time, which is costly and time consuming. This was alleviated in a later version HTTP/1.1 which enabled the `keep-alive` option so that multiple calls could share the same connection handshake. 

However, multiple calls still had to be serialised one by one, and the only way to make concurrent calls was with multiple TCP connections. Even though the cost of the handshake is saved, concurrency is still not achieved.

## HTTP/2
### TCP/IP, multiplexing
HTTP/2 introduced multiplexing of streams of data over a single tcp connection. This meant true concurrency at the network level as the client could request multiple tcp connections in parallel.

However, this also brought a downside when it comes to packet loss. This is because the HTTP/2 protocol is not aware of _where_ in the stream of data the data is lost; only that _some_ data was lost. The only solution available is to resend all of the tcp connections data streams, this is known as `head of line blocking`.

## HTTP/3
### QUIC/IP, fast handshake, UDP connections
HTTP/3 streams packets concurrently over UDP connections. This is an unsigned and so unreliable protocol, but the client is able to resend packets with data loss without effecting the other concurrent connections.

Also, because of the UDP connections, the handshake protocol has been greatly reduced to carry out all necessary passing of keys, encryption, etc, in a single back-and-forth, greatly reducing round trip time over HTTP/2 which needed to carry out 2 or more back-and-forths.