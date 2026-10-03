-- Follow-up to rooms.sql: support catalogue FK checks and destination lookups.
create index tripcircle_room_votes_destination on tripcircle_private.room_votes(destination_id);
