use tokio::task::JoinHandle;
use tokio_postgres::{Client, Config, Error, NoTls};

pub struct DB {
    client: Client,
    connection_join_handle: JoinHandle<()>,
}

impl DB {}

pub async fn connect(
    host: &str,
    port: u16,
    dbname: &str,
    user: &str,
    password: &str,
) -> Result<DB, Error> {
    let mut config = Config::new();

    let (mut client, connection) = config
        .host(host)
        .port(port)
        .dbname(dbname)
        .user(user)
        .password(password)
        .connect(NoTls)
        .await?;

    // The connection object performs the actual communication with the database,
    // so spawn it off to run on its own.
    let connection_join_handle = tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });

    mod embedded {
        use refinery::embed_migrations;
        embed_migrations!("./src/migrations/");
    }

    client
        .execute("create schema if not exists kuzh ;", &[])
        .await?;

    embedded::migrations::runner()
        .set_migration_table_name("kuzh.refinery_schema_history")
        .run_async(&mut client)
        .await
        .unwrap();

    Ok(DB {
        client,
        connection_join_handle,
    })
}
