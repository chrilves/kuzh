mod indexeddb;

use futures::{SinkExt, StreamExt};
use gloo_net::websocket::{futures::WebSocket, Message};
use wasm_bindgen_futures::spawn_local;
use web_sys::{
    console::log_1, IdbDatabase, IdbObjectStoreParameters, IdbOpenDbRequest, IdbVersionChangeEvent,
};
use yew::prelude::*;

// Use `wee_alloc` as the global allocator.
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

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

async fn db() {
    use wasm_bindgen::{prelude::*, JsCast};
    use web_sys::Window;
    let win: Window = web_sys::window().unwrap();
    console_log!("window open");
    let db = win.indexed_db().unwrap().unwrap();
    db.delete_database("kuzh");
    let upgrade = |event: IdbVersionChangeEvent| {
        let db = event
            .target()
            .unwrap()
            .unchecked_into::<IdbOpenDbRequest>()
            .result()
            .unwrap()
            .unchecked_into::<IdbDatabase>();
        let mut params = IdbObjectStoreParameters::new();
        params.auto_increment(false);
        params.key_path(Some(&JsValue::from("id")));
        db.create_object_store_with_optional_parameters("room_events", &params)
            .unwrap();
        db.create_object_store_with_optional_parameters("room_state", &params)
            .unwrap();
    };
    match indexeddb::open_db(db, "kuzh", 3, upgrade).await {
        Err(indexeddb::IndexedDBOpenError::Blocked(_)) => console_log!("Blocked"),
        Err(indexeddb::IndexedDBOpenError::Error(_)) => console_log!("Error"),
        Err(indexeddb::IndexedDBOpenError::JsValueError(js)) => console_log!("JsError"),
        Ok(indexeddb::IndexedDBOpened { database }) => {
            let stores = database.object_store_names();
            if stores.contains("blocks") {
                console_log!("Contains blocks");
            } else {
                console_log!("Not Contains blocks");
            }
        }
    }

    console_log!("Finished");
}

pub fn main() {
    spawn_local(db());
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
