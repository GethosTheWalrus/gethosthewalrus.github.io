# Full stack JavaScript app utilizing JSON-relational duality views <span style="opacity:0.5;margin:0;padding:0;font-size:14px;">- November 15, 2023</span>

This article describes how to build a full stack Flappy Bird clone backed by Oracle's [JSON-relational duality views](https://docs.oracle.com/en/database/oracle/oracle-database/23/jsnvu/overview-json-relational-duality-views.html#:~:text=A%20JSON%2Drelational%20duality%20view%20declaratively%20defines%20a%20mapping%20between,programming%20objects%20to%20relational%20data.&text=Duality%20views%20give%20you%20better,and%20operations%20at%20any%20level.) feature in [Oracle Free23c](https://www.oracle.com/database/free/). The final outcome of this guide is a containerized application consisting of the following:

* An HTML Flappy Bird game client written using [Phaser.js](https://phaser.io/)
* A backend API written using [Node.js](https://nodejs.org/en), [Express.js](https://expressjs.com/), and the [Oracle NodeJS Libraries](https://oracle.github.io/node-oracledb/)
* A local database (based on the [Oracle Free23c Docker image](https://www.oracle.com/database/free/))

The full source code and all linked files can be found on my GitHub here. If you prefer to run things right away, you can start all three services by executing the command below within the root of the repository:

```
docker-compose up
```

*Note, you will need to wait for the database to fully start up and execute the startup scripts before accessing the app.

<hr>

# Setting up the database

Getting the database to a state of usability takes only a few minutes. In order to follow along below, make sure you have a working [Docker](https://www.docker.com/) installation on your machine, along with [docker-compose](https://docs.docker.com/compose/). Before moving on, clone the [GitHub Repository](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/json-relational-duality) onto your machine.

With Docker installed and configured on your machine, simply run the following command from the root of the repository.

```
docker-compose up -d oracle
```

The above command will handle setting up the database infrastructure, port mappings, and will even run the initialization scripts that will create the schema and tables required for our app to function.

Either wait a few minutes, or remove the -d switch from the command above to see the Oracle database's output. When all of that is done, you should see similar output to the below in your terminal:

You should now be able to connect to the database using your favorite supported database client, such as [Oracle SQL Developer](https://www.oracle.com/database/sqldeveloper/). 

<div class="blog-content-block">
    <img src="/img/blog/1700007274084.png" />
</div>

Connect to the database instance using the sys user and the SYSDBA role. Enter localhost in the Hostname field, password in the Password field, and 1521 in the Port field. Finally, select the Service Name radio button and enter FREEPDB1. Test and save your connection.

<div class="blog-content-block">
    <img src="/img/blog/1700006297958.png" />
</div

<hr>

## Setting up the application backend

Now that our database is running and ready to be consumed, we will stand up a backend API that will consume it, and expose the underlying data to our game client.
Application architecture

The backend found within the app folder of the GitHub repo is a simple RESTful API written in [TypeScript](https://www.typescriptlang.org/) using Node.js and Express.js. 

The figure below shows the basic flow of data from a client machine all the way to the database in the context of our backend.

<div class="blog-content-block">
    <img src="/img/blog/1699911024167.png" />
</div

Our express app has a single router (playersRouter) with 4 API endpoints. Each of which will support core functions of our game: 

GET /users - Lists all registered users
POST /users - Adds a new user
GET /users/:user - Retrieves a single user corresponding to a given user ID
POST /users/:user/scores - Adds a new score for a user

An example that corresponds to #3 above can be observed below:

```
playersRouter.route('/users/:user')
    /* 
    * View a selected registerred user
    * output: Player[]
    */
    .get( async (req: Request, res: Response ) => {
        ...
    })
```

Each of our four endpoints is attached to an anonymous handler function which receives an HTTP Request and HTTP Response object as inputs. These handler functions process the HTTP request data using custom [types](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/main/app/models), [middleware](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/main/app/middleware), and [services](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/main/app/services). Using a combination of these three resources, the backend is able to interface with the database and provide the required functionality to our game.

<hr>

## Oracle database service

A particularly interesting service in this application is the [Oracle Database service](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/main/app/services/oracleDB.service.ts), which is used to simplify interacting with the database. It provides the following exported functions for use within our route handlers described in the previous section:

```
async function insertNewUser(username: string): Promise<number>

async function getScoresForUsers(userId?: number): Promise<Player[]>

async function insertNewScoreForUser(userId: number, score: number)
```

If we take a look at the function bodies, we can see some good examples of how simple it is to interact with our Oracle database. In the snippet below, we can see the process of querying our view and assigning the retrieved records to variables of our [custom type (Player)](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/main/app/models/scores.type.ts).

```
connection = await openConnection();

let query: string = "select json_serialize(t.data) as DATA from GAMEDB.PLAYER_SCORES t where t.data.id = :userid"
    
let bindParams: { userId?: number } = {};

if (userId) {
    bindParams.userId = userId;
}

var result = await connection.execute( 
    query, 
    bindParams, 
    {
        resultSet: true, 
        outFormat: oracledb.OUT_FORMAT_OBJECT 
    }
);

// scan results
const rs = result.resultSet; 
let row;
while ((row = await rs!.getRow())) {
    let resultObject: { DATA?: string } = row as Object
    players.push(
        JSON.parse(
            resultObject.DATA as string
        ) as Player
    );
}
await rs!.close();
```

This allows us to interact directly with our data using our application's native types; there's no need for an ORM or any massaging of the data. Taking a quick look at a single record produced by the query above should illustrate this concept more clearly. Example below:

```
{
    "_metadata" :
    {
        "etag" : "6D561324B29377437F6196B134635285",
        "asof" : "0000000000816700"
    },
    "username" : "mike_t",
    "id" : 4,
    "scores" : [
        {
        "id" : 64,
        "value" : 3
        },
        {
        "id" : 65,
        "value" : 4
        }
    ]
} 
```

When comparing the above record to our custom type, you can see that the records returned by our query map pretty much perfectly to the fields in our [Player type](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/main/app/models/scores.type.ts). 

In addition to selects, we can also run [inserts](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/abe232ec6a81e04fa4182b90dfcb6e106bf28e9b/app/services/oracleDB.service.ts#L27C1-L27C1) and updates directly on this view and Oracle Free23c will automatically update the underlying relational tables. This way we can modify our data without the need for multiple queries, complex transactions, etc.

A big benefit of using JSON-relational duality views is the ability to store the underlying data for our application in a normalized fashion, while consuming it as JSON documents. This provides us with an efficient storage schema with virtually zero redundant data combined with the extreme ease of use provided by JSON documents.

The cherry on top of all of the aforementioned benefits is that you can interact with the view and the underlying data at the same time, allowing you to [query individual tables](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/abe232ec6a81e04fa4182b90dfcb6e106bf28e9b/app/services/oracleDB.service.ts#L73) when it fits your usage pattern.
Running the backend

Now that we've explored some of the benefits and features of JSON-relational duality views, let's actually run the backend. 

Within the root of the repository, start the backend by executing the following in your terminal:

docker-compose up -d node

The above will handle all of the setup for you, including installing dependencies, mapping ports, setting environment variables, [transpiling](https://github.com/GethosTheWalrus/game-backend-oracle-db/tree/main/app/dist) the TypeScript to JavaScript, and running the transpiled code in the node runtime environment. 

You can also run the backend using a local Node.js installation by executing the dev script found in package.json. If you do this, make sure you create a .env file inside of the app folder and set the [environment variables](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/0f121c81f23c3810590fc5aa320ee77bedb4c369/docker-compose.yml#L21) that are being set in docker-compose.yml.

If you want to test things out, you can run the following command in your terminal:

curl localhost:3000/users/

If everything is working, you should see JSON output similar to the below:

```
[
    {
    "_metadata": {
        "etag": "731C3E63930A5B64FD57D9ACFDC55473",
        "asof": "0000000000304383"
    },
    "username": "BigBird",
    "id": 1,
    "scores": [
        {
            "id": 1,
            "value": 5
        },
        {
            "id": 2,
            "value": 9
        }
        ]
    }
]
```

<hr>

## Consuming the backend

Now that we have a working database and backend up and running, we can start up our game client designed to consume our backend.

The game client is a simple web application and will run like any other website. You can run it by executing the following in your terminal:

docker-compose up -d webserver

If you would like to run it on your machine instead of inside of a Docker container, simply start a basic [http server](https://www.npmjs.com/package/http-server) in the flappy-bird directory and navigate to the URL shown in your terminal.

<div class="blog-content-block">
    <img src="/img/blog/1699927742771.png" />
</div>

Several things are happening when the page loads:

Our API endpoint localhost:3000/users/ is called to load the list of users and their scores. The list of Player objects is stored locally.
The list of Players is used to populate the Player selector at the top of the page.
The list of Players is searched for the current high score holder. This information is saved in a local variable and displayed at the bottom of the screen.

You may have also noticed the New User button at the top of the screen, to the right of the Player selector. Clicking this button brings up a dialog that allows you to add a new user. After providing a username, our [backend API endpoint](https://github.com/GethosTheWalrus/game-backend-oracle-db/blob/65170c8b765b3d2438aedb96e9a0a837e4595286/app/routes/playersRouter.ts#L31C6-L31C6) is called and the new User is added to our Oracle database.

After selecting a Player (or creating the first one), we can start the game by pressing the space bar (or tapping the screen on mobile) and preparing to flap.

<div class="blog-content-block">
    <iframe width="560" height="315" src="https://www.youtube.com/embed/NeCHu93dT4Y?si=LUuW2Jo2TOCP61Pk" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

Not my best score, but what's exciting about that is that if we query our JSON-relational duality view with the following query (replacing the number 4 with your user's ID):

```
select json_serialize(t.DATA pretty) as DATA from GAMEDB.PLAYER_SCORES t where t.DATA.id = 4;
```

We can see that the new score was posted to our backend and inserted into the database for consumption.

```
{
    "_metadata" :
    {
        "etag" : "285E535E7B710AB72CCC4904F2B7FCBB",
        "asof" : "0000000000817AA4"
    },
    "username" : "mike_t",
    "id" : 4,
    "scores" : [
        {
        "id" : 128,
        "value" : 4
        }
    ]
}
```

This is also observable by calling our API endpoint designed to view users:

curl localhost:3000/users/4

And the result below:

```
[
    {
        "_metadata": {
            "etag": "285E535E7B710AB72CCC4904F2B7FCBB",
            "asof": "0000000000817AFE"
        },
        "username": "mike_t",
        "id": 4,
        "scores": [
            {
                "id": 128,
                "value": 4
            }
        ]
    }
]
```

## Summary

Creating a full stack JavaScript-based application provides the benefit of keeping things consistent across the stack. Integrating Oracle's JSON-relational duality views from Free23c is a great way to mitigate some of the trade-offs of using JSON Document databases.

Hopefully this exercise has demonstrated how easy it can be to integrate your app with the Oracle database, and begin taking advantage of JSON-relational duality views.

Looking to build upon this tutorial? Check out this [part 2](/blog/?post=oracle-advanced-queue-flappy-bird) where I show you how to implement a chat room using Oracle Advanced Queuing. 