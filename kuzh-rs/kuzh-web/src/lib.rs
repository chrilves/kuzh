
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use gluesql_core::{ast_builder::*, prelude::Glue, ast::Statement};
use gluesql_idb_storage::IdbStorage;

#[wasm_bindgen]
pub fn main() {
    spawn_local(async {
        let store = IdbStorage::new(Some(String::from("kuzh-idb-storage"))).await.unwrap();
        let mut glue : Glue<IdbStorage> = Glue::new(store);
        glue.execute_stmt(&CreateTableNode::new(String::from("toto"), false).build().unwrap()).await.unwrap();
    });
}
