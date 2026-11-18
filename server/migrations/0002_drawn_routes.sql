-- Drawn routes: the sender's path from the entry point to the house, with text landmarks.
-- All coordinates are WGS84; geography columns measure in meters.

CREATE TABLE routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the secret token in the sender's edit link, as 64 hex characters. The token itself is never stored.
  owner_token_hash text NOT NULL CHECK (owner_token_hash ~ '^[0-9a-f]{64}$'),
  title            text CHECK (char_length(title) <= 120),
  -- In the rider's order: first point = entry point (where road directions end), last point = road in front of the house.
  path             geography(LineString, 4326) NOT NULL,
  -- The door itself, within 100 m of the path's last point (a house is often set back from the road).
  door             geography(Point, 4326) NOT NULL,
  length_m         real NOT NULL CHECK (length_m >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Text landmarks along a route, such as "turn left after the green gate".
CREATE TABLE landmarks (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id  uuid NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  position  geography(Point, 4326) NOT NULL,
  -- Distance from the entry point along the path: orders the landmarks and finds the next one.
  along_m   real NOT NULL CHECK (along_m >= 0),
  note      text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 200)
);

CREATE INDEX landmarks_route_idx ON landmarks (route_id, along_m);
