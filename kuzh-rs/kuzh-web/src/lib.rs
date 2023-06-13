
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::spawn_local;
use gluesql::core::ast_builder::*;
use gluesql::prelude::*;

#[wasm_bindgen]
pub fn main() {
    spawn_local(async {
        
        let mut glue : Glue<IdbStorage> = Glue::new(gluesql_idb_storage::IdbStorage::new(Some(String::from("kuzh-idb-storage"))).await.unwrap());
    
        let actual = table("Foo")
        .create_table()
        .execute(&mut glue)
        .await
        .unwrap();
    });
}
