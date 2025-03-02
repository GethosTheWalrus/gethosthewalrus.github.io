# Express, TypeScript, and Oracle Advanced Queue <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- November 25, 2023</span>

This guide builds upon my [previous article](/blog/?post=json-relational-duality-oracle-flappy-bird) which details how to build a Flappy bird game on top of an Oracle database. If you haven't seen that one yet, I recommend giving it a read and running its [associated code](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/json-relational-duality).

The goal of this article is to demonstrate how to use [Oracle Advanced Queuing](https://www.oracle.com/database/technologies/advanced-queuing.html) and how it can be a great alternative to message brokers such as [RabbitMQ](https://www.rabbitmq.com/) when building applications on top of an Oracle database.

In addition to the deliverables of the previous article, the outcome of this guide is:

* An instant-messaging UI component integrated into our flappy bird game
* Backend functionality to ingest chat events and their associated messages from connected users
* A background process that polls for newly queued messages and broadcasts them on a schedule

The full source code and all linked files can be found on my GitHub [here](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/advanced-queue). If you prefer to run things right away, you can start all three services by executing the command below within the root of the repository:

```
docker-compose up
```

*Note, you will need to wait for the database to fully start up and execute the startup scripts before accessing the app.

<hr>

## Modifying the database

There are a few database changes we will need to make for our new feature to work properly. While our startup database scripts will handle this for us, it is helpful to understand exactly what changes are being made.

If you a look at the [SQL snippet](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/database-scripts/06.sql#L4) below, you will notice that we are creating a queue and queue table to support our messaging functionality.

```
BEGIN
  DBMS_AQADM.CREATE_QUEUE_TABLE(
    QUEUE_TABLE        =>  'GAMEDB.GAME_CHAT_TABLE',
    QUEUE_PAYLOAD_TYPE =>  'RAW');

  DBMS_AQADM.CREATE_QUEUE(
    QUEUE_NAME         =>  'GAMEDB.GAME_CHAT_QUEUE',
    QUEUE_TABLE        =>  'GAMEDB.GAME_CHAT_TABLE');

  DBMS_AQADM.START_QUEUE(
    QUEUE_NAME         => 'GAMEDB.GAME_CHAT_QUEUE');
END;
```

The queue (GAME_CHAT_QUEUE) is the data structure which will physically hold our messages, whereas the queue table (GAME_CHAT_TABLE) gives us a convenient database table structure for visualizing how our queue is populated. 

After enqueuing a few messages, we can run the following query:

```
SELECT * FROM GAMEDB.GAME_CHAT_TABLE;
```

to see our queued up messages, ready to be dequeued and processed accordingly:

<div class="blog-content-block">
    <img src="/img/blog/1700875344694.png" />
</div>

Speaking of enqueuing messages, we will need some means of getting messages onto and off of our queue. Depending on your host machine's architecture, this can be as simple as using the [native functionality](https://blogs.oracle.com/developers/post/producing-and-consuming-messages-in-nodejs-with-oracle-advanced-queuing-aq#Add%20Enqueue%20(Single)%20Method) provided by the [Oracle database driver](https://oracle.github.io/node-oracledb/) for Node.js. To provide the highest level of compatibility, we will be writing some simple PL/SQL procedures to satisfy this requirement.

The following [procedure](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/database-scripts/06.sql#L18) will enqueue a provided message:

```
create or replace function GAMEDB.ENQUEUEMESSAGE
   ( message IN varchar2 ) 
    RETURN varchar2
IS
    l_enqueue_options     dbms_aq.enqueue_options_t;
    l_message_properties  dbms_aq.message_properties_t;
    l_message_handle      raw(16);
    l_event_msg           raw(32767);
    msg_text              varchar2(32767);
BEGIN
    l_event_msg := utl_raw.cast_to_raw(message);
    dbms_aq.enqueue(queue_name => 'GAMEDB.GAME_CHAT_QUEUE',
                   enqueue_options => l_enqueue_options,
                   message_properties => l_message_properties,
                   payload => l_event_msg,
                   msgid => l_message_handle);
    msg_text := utl_raw.cast_to_varchar2(l_event_msg);
    return msg_text;
END ENQUEUEMESSAGE;
```

And [this one](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/database-scripts/06.sql#L39) will dequeue a message:

```
create or replace function GAMEDB.DEQUEUEMESSAGE RETURN varchar2 AS
    l_dequeue_options     dbms_aq.dequeue_options_t;
    l_message_properties  dbms_aq.message_properties_t;
    l_message_handle      raw(16);
    l_event_msg           raw(32767);
    msg_text              varchar2(32767);
    queue_length          number;
BEGIN
    msg_text := '{}';
    SELECT COUNT(*) INTO queue_length FROM GAMEDB.GAME_CHAT_TABLE;
    IF queue_length > 0 THEN
        dbms_aq.dequeue(queue_name => 'GAMEDB.GAME_CHAT_QUEUE',
                       dequeue_options => l_dequeue_options,
                       message_properties => l_message_properties,
                       payload => l_event_msg,
                       msgid => l_message_handle);
    
        msg_text := utl_raw.cast_to_varchar2(l_event_msg);
    END IF;
    return msg_text;
END DEQUEUEMESSAGE;
```

For the sake of simplicity, these procedure enqueue and dequeue raw messages rather than messages of a more structured data type (such as [JSON](https://www.json.org/json-en.html)). 

<hr>

## Consuming our queue via Node.js

Now that our queue is setup within the database, we can start interacting with it via our application code. Some examples of such interactions are:

* [Enqueuing](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/services/oracleQueue.service.ts#L7) a chat message sent by a connected user
* [Dequeuing](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/services/oracleQueue.service.ts#L67) a batch of chat messages [within an interval function](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/services/server.service.ts#L74C13-L74C13)
* [Broadcasting](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/services/server.service.ts#L78C17-L78C17) the batch of messages to all of the connected users

<hr>

## Adding messages to the queue

Enqueuing messages is simple since we created our ENQUEUEMESSAGE procedure. All we need to do is create a JSON string representing our message, and bind it to a query that calls that procedure:

```
let messageString: string = JSON.stringify(message);

/* invoke our PLSQL function to dequeue a message from our AQ */
let query: string  = 
    `DECLARE
        returnValue varchar2(32767);
     BEGIN
         :returnValue := GAMEDB.ENQUEUEMESSAGE(:message);
     END;`;

let bindParams = {
    message: messageString,
    returnValue: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
};

// execute the query above
let result: OracleDB.Result<{returnValue: ChatMessage}> = await connection.execute(
    query, 
    bindParams, 
    {
        resultSet: true, 
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true
    }
);
```

Calling this code from an [API endpoint](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/routes/chatRouter.ts#L12C1-L12C1) handler function can give us a convenient way to enqueue chat messages from our front end:

```
chatRouter.route('/chat')
/*
 * Accept a new chat message from a user
 * output: ChatMessage
 */
    .post( async (req: Request, res: Response) => {
        let newMessage: ChatMessage = req.body;
        let enqueuedMessage: ChatMessage = await enqueueOne(newMessage);
        res.status(202).send(enqueuedMessage);
    });
```

Although REST is a convenient and valid method of getting our messages delivered to the database, it requires the front end to constantly poll the backend when we dequeue and process messages. This is not ideal, as it adds a decent bit of overhead when the queue is empty for an extended period of time. A better approach for our use case is [web sockets](https://www.geeksforgeeks.org/what-is-web-socket-and-how-it-is-different-from-the-http/), which we will implement using [Socket.io](http://socket.io/).

If you take a look at the code that has been reorganized into our new [server service](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/advanced-queue/app/services/server.service.ts), you can see how easy it is to [setup a web socket listener](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/services/server.service.ts#L42) and respond to events. In the below example, we are enqueuing a single received message when a chat event is observed:

```
socket.on('chat', async (message: ChatMessage) => {
    let players: Player[] = await getScoresForUsers(Number(message.user));
    
    if (players.length < 1) {
        return;
    }
    
    let player = players[0];
    message.user = String(player.username);
    message.socketId = socket.id;
    enqueueOne(message);
});
```

As you can see, our message is passed to the handler function as a parameter and enqueued asynchronously. Since the client is not waiting for a response, we do not need to await the response of [enqueueOne](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/app/services/oracleQueue.service.ts#L7). 
Consuming messages from the queue

Now that we are able to get messages onto the queue, we need to get them off and processed. In our design, chat messages are added to the queue one by one, and processed in batches. Inspiration for this design was taken from the chat feature of streaming services such as Twitch and YouTube.

To achieve this, we can simply invoke our DEQUEUEMESSAGE PL/SQL procedure within an interval function. The snippet below shows how this works:

```
setInterval( async () => {
  // dequeue our messages
  let batchOfMessages = await dequeueMany(CHAT_POLL_MESSAGE_COUNT);
  // broadcast the messages to our connected clients
  console.log('broadcasting ', batchOfMessages.length, ' messages');
  batchOfMessages.forEach( (message: ChatMessage) => {
    ServerService.io.emit('chat', message);
  });
 }, CHAT_POLL_INTERVAL);
}
```

We configured environment variables for the size of each batch and the time between dequeue operations. Every X seconds, Y messages are dequeued and broadcasted in order to all of the connected clients. The front end contains the [following code](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0eac1ea7e3d0423afce14cfd48f6238b25554899/flappy-bird/chat.script.js#L88):

```
socket.on('chat', (message) => {
  // logic to display the broadcasted messages
});
```

which will listen for a chat event sent by the server, and render a new message based on the event message content. You can see a demo of this working end to end below, as I send a message from one tab, then switch to another and receive it:

<div class="blog-content-block">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/0WakS66dqd4?si=ZeTMAPkK0EAxf2Sm" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

<hr>
 
## Summary

Now that everything is up and running, you should be able to chat with your friends who have network access to your host machine on port 8080. If you both play a few rounds of Flappy Bird, you'll notice that your scores are also broadcasted after each round, using the same tech as the chat interface. 

Although everything is running within a single micro service in this example, a more production-ready setup would probably have the RESTful API and chat backend split into distinct micro services (possibly with their own [PDBs](https://docs.oracle.com/en/database/oracle/oracle-database/21/cncpt/CDBs-and-PDBs.html#:~:text=Within%20a%20CDB%2C%20each%20container,client%20as%20a%20separate%20database.)). 

Taking advantage of Oracle Advanced Queuing is a great way to simplify your application infrastructure. Having to maintain infrastructure for many application components can be challenging. Consolidating your databases and message brokers into an Oracle database can simplify the architecture and administration of your application stack.

I hope this has demonstrated the benefits and ease of use of Advanced Queuing within the Oracle database. 