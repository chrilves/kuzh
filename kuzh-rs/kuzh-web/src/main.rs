
use futures::{SinkExt, StreamExt};
use gloo_net::websocket::{futures::WebSocket, Message};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use web_sys::console::log_1;
use yew::prelude::*;

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => {
        (log_1(&format_args!($($t)*).to_string().into()))
    }
}

#[function_component]
fn App() -> Html {
    let counter = use_state(|| 0);
    use kuzh_common::crypto::*;

    let secret1 = use_state(SecretKey::random);
    let secret2 = use_state(SecretKey::random);

    let onclick = {
        let counter = counter.clone();
        let s1 = secret1.clone();
        let s2 = secret2.clone();
        move |_| {
            let value = *counter + 1;
            counter.set(value);
            s1.set(SecretKey::random());
            s2.set(SecretKey::random());
            toto()
        }
    };

    let public1 = PublicKey::from(&*secret1);
    let public2 = PublicKey::from(&*secret2);
    let dh1 = &*secret1 * &public2;
    let dh2 = &*secret2 * &public1;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    html! {
        <div>
            <button {onclick}>{ "+1" }</button>
            <p>{ *counter }</p>
            <ul>
                <li>{format!("Secret 1: {}", URL_SAFE_NO_PAD.encode((*secret1).to_bytes()))}</li>
                <li>{format!("Public 1: {}", URL_SAFE_NO_PAD.encode(public1.to_bytes()))}</li>
                <li>{format!("Secret 2: {}", URL_SAFE_NO_PAD.encode((*secret2).to_bytes()))}</li>
                <li>{format!("Public 2: {}", URL_SAFE_NO_PAD.encode(public2.to_bytes()))}</li>
                <li>{format!("Diffie 1: {}", URL_SAFE_NO_PAD.encode(dh1.to_bytes()))}</li>
                <li>{format!("Diffie 2: {}", URL_SAFE_NO_PAD.encode(dh2.to_bytes()))}</li>
            </ul>
        </div>
    }
}

async fn migrate() {
    use gluesql::*;
    use gluesql::core::*;
    use gluesql::core::ast::*;
    use gluesql::core::ast_builder::*;
    use gluesql::prelude::*;
    use gluesql::core::store::*;

    let mut storage = gluesql_idb_storage::IdbStorage::new(Some(String::from("kuzh-idb-storage"))).await.unwrap();
    let mut glue : Glue<IdbStorage> = Glue::new(storage);

    console_log!("Commencé");
    glue.execute_stmt_async(&begin().unwrap()).await.unwrap();
    console_log!("Fini");

    let actual = table("Foo")
    .create_table()
    .add_column("id INTEGER")
    .add_column("name TEXT")
    .execute(&mut glue)
    .await;
}

pub fn main() {
    spawn_local(migrate());
    yew::Renderer::<App>::new().render();
}

fn toto() {
    let ws = WebSocket::open("ws://localhost:9000").unwrap();
    let (mut write, mut read) = ws.split();

    spawn_local(async move {
        write
            .send(Message::Text(String::from("test")))
            .await
            .unwrap();
        write
            .send(Message::Text(String::from("test 2")))
            .await
            .unwrap();
    });

    spawn_local(async move {
        while let Some(msg) = read.next().await {
            console_log!("1. {:?}", msg)
        }
        console_log!("WebSocket Closed")
    })
}
