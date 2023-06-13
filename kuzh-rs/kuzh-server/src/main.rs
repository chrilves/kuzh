//! A chat server that broadcasts a message to all connections.
//!
//! This is a simple line-based server which accepts WebSocket connections,
//! reads lines from those connections, and broadcasts the lines to all other
//! connected clients.
//!
//! You can test this out by running:
//!
//!     cargo run --example server 127.0.0.1:12345
//!
//! And then in another window run:
//!
//!     cargo run --example client ws://127.0.0.1:12345/
//!
//! You can run the second command in multiple windows and then chat between the
//! two, seeing the messages from the other client as they're received. For all
//! connected clients they'll all join the same room and see everyone else's
//! messages.

use std::{
    collections::HashMap,
    env,
    io::{Error as IoError, ErrorKind},
    net::SocketAddr,
    sync::{Arc, Mutex},
};

use futures_channel::mpsc::{unbounded, UnboundedSender};
use futures_util::{future, pin_mut, stream::TryStreamExt, SinkExt, StreamExt, TryFutureExt};

use refinery::Runner;
use tokio::net::{TcpListener, TcpStream};
use tokio_postgres::GenericClient;
use tokio_tungstenite::tungstenite::protocol::Message;

type Tx = UnboundedSender<Message>;
type PeerMap = Arc<Mutex<HashMap<SocketAddr, Tx>>>;
use kuzh_common::crypto::*;

async fn handle_connection(raw_stream: TcpStream, addr: SocketAddr) {
    println!("Incoming TCP connection from: {}", addr);

    let ws_stream = tokio_tungstenite::accept_async(raw_stream)
        .await
        .expect("Error during the websocket handshake occurred");
    println!("WebSocket connection established: {}", addr);

    // Insert the write part of this peer to the peer map.
    let (mut outgoing, mut incoming) = ws_stream.split();

    while let Some(r) = incoming.next().await {
        match r {
            Ok(msg) => {
                println!(
                    "Received a message from {}: {}",
                    addr,
                    msg.to_text().unwrap()
                );
                outgoing.send(msg).await;
            }
            Err(e) => println!("Received an error message from {}: {}", addr, e),
        }
    }

    println!("{} disconnected", &addr);
}

#[tokio::main]
async fn main() -> Result<(), IoError> {

    use tokio_postgres::Connection;
    use tokio_postgres::{NoTls, Error, Config};

    let mut config = Config::new();
    
    let (mut client, connection) =
        config
            .host("localhost")
            .port(5432)
            .dbname("kuzh")
            .user("kuzh")
            .password("kuzh")
            .connect(NoTls)
            .await
            .unwrap(); 

    // The connection object performs the actual communication with the database,
    // so spawn it off to run on its own.
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    // Now we can execute a simple statement that just returns its parameter.
    let rows = client
        .query("SELECT $1::TEXT", &[&"hello world"])
        .await.unwrap();

    mod embedded {
        use refinery::embed_migrations;
        embed_migrations!("./src/sql_migrations/");
    }
    client.execute("create schema if not existskuzh ;", &[]).await.unwrap();
    embedded::migrations::runner()
        .set_migration_table_name("kuzh.refinery_schema_history")
        .run_async(&mut client)
        .await
        .unwrap();

    let secret1 = SecretKey::random();
    let public1 = PublicKey::from(&secret1);
    let secret2 = SecretKey::random();
    let public2 = PublicKey::from(&secret2);

    let dh1 = &secret1 * &public2;
    let dh2 = &secret2 * &public1;

    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    use hex::encode;
    println!(
        "secret 1: {}\npublic 1: {}\nsecret 2: {}\npublic 2: {}\ndiffie 1: {}\ndiffie 2: {}\n",
        URL_SAFE_NO_PAD.encode(secret1.to_bytes()),
        URL_SAFE_NO_PAD.encode(public1.to_bytes()),
        URL_SAFE_NO_PAD.encode(secret2.to_bytes()),
        URL_SAFE_NO_PAD.encode(public2.to_bytes()),
        URL_SAFE_NO_PAD.encode(dh1.to_bytes()),
        encode(dh2.to_bytes())
    );

    let addr = env::args()
        .nth(1)
        .unwrap_or_else(|| "127.0.0.1:9000".to_string());

    // Create the event loop and TCP listener we'll accept connections on.
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind");
    println!("Listening on: {}", addr);

    // Let's spawn the handling of each connection in a separate task.
    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(stream, addr));
    }

    Ok(())
}
