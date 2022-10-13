---
title: The Journey of a Refactor
draft: false
---
Basically, I was trying to do something and went down the wrong path, and when I finally saw the light it all got a lot better.

## Problem
I’m trying to write a test that makes sure that no other fields in the db are effected when we write to the db - only the field that we care about. The issue is that when you decode a response from the db to a go struct, you can use **known** fields with a struct, or **unknown** fields with a map, but you can’t do a mix. So, I wanted;

```
type dbResponse struct {
	Id          string                   `bson:"_id"`         // known
	knownFields map[string]bool          `bson:"knownFields"` // known
	otherFields map[string]interface{}                        // unknown
}
```

I started off down the path of trying to make this work. One way is to go to the db twice (not performant, but that’s not a big deal here) and marshal once for the known and again for the unknown. So two new types:

```
type dbResponseKnown struct {
	Id          string          `bson:"_id"`         // known
	knownFields map[string]bool `bson:"knownFields"` // known
}
type dbResponseUnknown map[string]interface{}
```

Then, try to combine these into a single data structure:  

```
func getUsersFromDB(mongoMainURI string) []dbResponse {
	mongoDB := fixtures.NewMongoDB(mongoMainURI)

	if err := mongoDB.Connect(); err != nil {
		panic(err)
	}

	defer mongoDB.Disconnect()

	var response []dbResponse
	if err := mongoDB.GetAllDocuments("mydb", "users", &response); err != nil {
		panic(err)
	}

	unstructuredResponse := make([]map[string]interface{}, len(response))
	if err := mongoDB.GetAllDocuments("mybd", "users", &unstructuredResponse); err != nil {
		panic(err)
	}
	for i := range response {
		delete(unstructuredResponse[i], "_id")
		delete(unstructuredResponse[i], "knownFields")
		response[i].otherFields = unstructuredResponse[i]
	}

	return response
}
```

## Complexity spike
This is where it’s a good point to take a deep breath and think about what happened to my lovely simple tests. Suddenly, I have two intermediate types on top of the actual type I need, plus my generic `getUsersFromDB`  logic is now littered with specifics about ids and knownFields. Somewhere along the way my abstractions went wrong.

## Diagnosis 
Simply put, `getUsersFromDB` is doing too much. It’s not _just_ getting users from the db - it’s also doing some mapping and filtering between known and unknown fields. This is only necessary for some tests anyway, so why complicate this function to work for every case?

## Solution
Each test provides the shape of the response that it needs.

```
func getUsersFromDBNEW(mongoMainURI string, response interface{}) {
   mongoDB := fixtures.NewMongoDB(mongoMainURI)

   if err := mongoDB.Connect(); err != nil {
      panic(err)
   }

   defer mongoDB.Disconnect()

   if err := mongoDB.GetAllDocuments("mydb", "users", response); err != nil {
      panic(err)
   }
}
```

The function receives the response shape that it needs, and the tests handle the rest. Now the tests look something like this:  

	```
	It("should not effect any other fields of the DB collection", func() {
			initCollection(mongoMainURI, map[string]interface{}{
				"_id":             testUser,
				"known-field":     map[string]bool{},
				"unrelated_field": "its value",
			})

			// act
			err := client.Set(ctx, testUser, key, true)

			// assert
            var users []map[string]interface{}
			getUsersFromDBNEW(mongoMainURI, &users)
			Expect(users[0]).To(HaveLen(3))
			Expect(users[0]).To(HaveKey("known-field"))
			Expect(users[0]).To(HaveKeyWithValue("_id", testUser))
			Expect(users[0]).To(HaveKeyWithValue("unrelated_field", "its value"))
		})
		```

And for an example where we would prefer known fields:  

		It("sets a value", func() {
			// arrange
			initCollection(mongoMainURI, map[string]interface{}{
				"_id":         testUser,
				"known-field": map[string]bool{key: true},
			})

			// act
			err := client.Set(ctx, testUser, key, false)

			// assert
			Expect(err).NotTo(HaveOccurred())
			var users []dbResponse
			getUsersFromDBNEW(mongoMainURI, &users)
			Expect(users).To(HaveLen(1))
			Expect(users[0].knownField).To(HaveLen(1))
			Expect(users[0].knownField).To(HaveKeyWithValue(key, false))
		})

## Conclusion
I like this because it looks stupidly obvious once it’s been written. 

When you show your work to someone, the best response you can hope for is "what, this took you all day?". It should look so obvious that all the other stuff you were trying out should seem like the naive meandering of a madman... or something like that.

Anyway, that's it for this little insight into my process!