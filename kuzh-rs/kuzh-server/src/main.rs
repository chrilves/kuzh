mod db;
mod handshake;
mod room;

use clap::Parser;
use std::{
    collections::HashMap,
    env,
    io::{Error as IoError, ErrorKind},
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
};

use futures_channel::mpsc::{unbounded, UnboundedSender};
use futures_util::{future, pin_mut, stream::TryStreamExt, SinkExt, StreamExt, TryFutureExt};

use refinery::Runner;
use tokio::net::{TcpListener, TcpStream};
use tokio_postgres::{Config, Connection, Error, GenericClient, NoTls};
use tokio_tungstenite::tungstenite::protocol::Message;

type Tx = UnboundedSender<Message>;
type PeerMap = Arc<Mutex<HashMap<SocketAddr, Tx>>>;
use kuzh_common::crypto::*;

#[derive(Parser, Debug)]
#[command(author="chrilves", version="0.0.1", about="KuZH Server", long_about = None)]
struct Args {
    /// PostgreSQL dost
    #[arg(short='H', long, default_value_t = String::from("localhost"))]
    db_host: String,

    /// PostgreSQL port
    #[arg(short = 'P', long, default_value_t = 5432u16)]
    db_port: u16,

    /// PostgreSQL user
    #[arg(short = 'U', long)]
    db_user: String,

    /// PostgreSQL user
    #[arg(short = 'W', long)]
    db_password: String,

    /// PostgreSQL database name
    #[arg(short = 'N', long)]
    db_name: String,

    /// IP to bind to
    #[arg(short='h', long, default_value_t = String::from("127.0.0.1"))]
    host: String,

    /// Port to bind to
    #[arg(short = 'p', long, default_value_t = 9000)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<(), IoError> {
    //let args = Args::parse();

    let mut pks = Vec::new();
    let mut sks = Vec::new();

    for j in 0..20000 {
        let s = SecretKey::random();
        sks.push(s);
        pks.push(s.public_key());
    }

    let sa = SecretKey::random();
    let pa = sa.public_key();

    let tag1 = b"tag1";
    let tag2 = b"tag2";

    use RingSig;

    let m1 = b"message1";
    let m2 = b"message2";

    let i = 58;
    let j: usize = 7;

    /*
    let si11 = RingSig::sign(tag1, &pks, m1, sks[i], i).unwrap();
    let si12 = RingSig::sign(tag1, &pks, m2, sks[i], i).unwrap();
    let si21 = RingSig::sign(tag2, &pks, m1, sks[i], i).unwrap();
    let si22 = RingSig::sign(tag2, &pks, m2, sks[i], i).unwrap();
    let sj11 = RingSig::sign(tag1, &pks, m1, sks[j], j).unwrap();
    let sj12 = RingSig::sign(tag1, &pks, m2, sks[j], j).unwrap();
    let sj21 = RingSig::sign(tag2, &pks, m1, sks[j], j).unwrap();
    let sj22 = RingSig::sign(tag2, &pks, m2, sks[j], j).unwrap();
    println!("verif 1: {:?}", si11.verify(tag1, &pks, m1));
    println!("verif 2: {:?}", sj12.verify(tag1, &pks, m2));
    println!(
        "trace: {:?}",
        RingSig::link(tag1, &pks, m1, &si11, m1, &sj12)
    );
    */

    let sig = sa.sign(m1);
    println!("sig: {:?}", pa.verify(m2, sig));

    Ok(())
    /*
        let kuzh_db = db::connect(
            &args.db_host,
            args.db_port,
            &args.db_name,
            &args.db_user,
            &args.db_password,
        )
        .await
        .unwrap();

        // Create the event loop and TCP listener we'll accept connections on.
        println!("Listening on {}:{}", &args.host, args.port);
        let listener = TcpListener::bind((args.host, args.port)).await.unwrap();

        // Let's spawn the handling of each connection in a separate task.
        while let Ok((stream, addr)) = listener.accept().await {
            tokio::spawn(handle_connection(stream, addr));
        }

        Ok(())
    */
}

async fn handle_connection(raw_stream: TcpStream, addr: SocketAddr) {
    println!("Incoming TCP connection from: {}", addr);

    let ws_stream = tokio_tungstenite::accept_async(raw_stream).await.unwrap();
    println!("WebSocket connection established: {}", addr);

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
