use futures::channel::mpsc::{self, Sender};
use futures::{SinkExt, StreamExt};
use thiserror::Error;
use wasm_bindgen::convert::FromWasmAbi;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::Event;
use web_sys::IdbDatabase;
use web_sys::IdbFactory;
use web_sys::IdbOpenDbRequest;
use web_sys::IdbVersionChangeEvent;

#[derive(Debug, Clone, Error)]
pub enum IndexedDBOpenError {
    #[error("Database blocked")]
    Blocked(IdbVersionChangeEvent),
    #[error("Error while opening database.")]
    Error(Event),
    #[error("Underlying error")]
    JsValueError(JsValue),
}

impl From<JsValue> for IndexedDBOpenError {
    fn from(value: JsValue) -> Self {
        IndexedDBOpenError::JsValueError(value)
    }
}

#[derive(Debug, Clone)]
pub struct IndexedDBOpened {
    pub database: IdbDatabase,
}

#[derive(Debug, Clone)]
enum IndexedDBOpenResponse {
    Blocked(IdbVersionChangeEvent),
    Success(Event),
    Error(Event),
}

fn uplift_closure<A, B, F>(mut sender: Sender<B>, f: F) -> Closure<(dyn FnMut(A) + 'static)>
where
    A: FromWasmAbi + 'static,
    B: 'static,
    F: FnOnce(A) -> B + 'static,
{
    Closure::once(move |event| {
        future_to_promise(async move {
            match sender.send(f(event)).await {
                Ok(()) => Ok(JsValue::NULL),
                Err(_send_error) => Err(JsValue::from("oops")),
            }
        });
    })
}

pub async fn open_db<F>(
    db: IdbFactory,
    name: &str,
    version: u32,
    onupgradeneeded: F,
) -> Result<IndexedDBOpened, IndexedDBOpenError>
where
    F: FnOnce(IdbVersionChangeEvent) + 'static,
{
    let request = db.open_with_u32(name, version)?;

    let (sender, mut receiver) = mpsc::channel::<IndexedDBOpenResponse>(2);

    let c1 = Closure::once(onupgradeneeded);
    request.set_onupgradeneeded(Some(c1.as_ref().unchecked_ref()));

    let c2 = uplift_closure(sender.clone(), |event| {
        IndexedDBOpenResponse::Success(event)
    });
    request.set_onsuccess(Some(c2.as_ref().unchecked_ref()));

    let c3 = uplift_closure(sender.clone(), |event| IndexedDBOpenResponse::Error(event));
    request.set_onerror(Some(c3.as_ref().unchecked_ref()));

    let c4 = uplift_closure(sender.clone(), |event| {
        IndexedDBOpenResponse::Blocked(event)
    });
    request.set_onblocked(Some(c4.as_ref().unchecked_ref()));

    loop {
        if let Some(item) = receiver.next().await {
            match item {
                IndexedDBOpenResponse::Blocked(event) => {
                    return Err(IndexedDBOpenError::Blocked(event))
                }
                IndexedDBOpenResponse::Error(event) => {
                    return Err(IndexedDBOpenError::Error(event))
                }
                IndexedDBOpenResponse::Success(_event) => {
                    return Ok(IndexedDBOpened {
                        database: request.result()?.unchecked_into(),
                    })
                }
            }
        }
    }
}
