use futures_util::Stream;

use crate::{
    answering::events::AnsweringEvent,
    answering::states::AnsweringState,
    chain::{AnsweringBlock, RoomBlock},
    newtypes::BlockHeight,
    room::events::RoomEvent,
    room::states::RoomState,
};

trait CommonDB {
    // RoomBlocks
    async fn store_room_block(block: RoomBlock);
    async fn stream_root_blocks(height: BlockHeight<RoomEvent>) -> impl Stream<Item = RoomBlock>;
    async fn last_room_block_height() -> Option<BlockHeight<RoomEvent>>;

    // RoomState
    async fn upsert_room_state(state: RoomState);
    async fn room_state() -> Option<RoomState>;

    // AnsweringBlocks
    async fn store_answering_block(block: AnsweringBlock);
    async fn stream_answering_blocks(
        height: BlockHeight<AnsweringEvent>,
    ) -> impl Stream<Item = AnsweringBlock>;
    async fn last_answering_block_height() -> Option<BlockHeight<AnsweringEvent>>;

    // AnsweringState
    async fn upsert_answering_state(state: AnsweringState);
    async fn answering_state() -> Option<AnsweringState>;
}
