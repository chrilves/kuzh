# KUZH API

- `GET /`

  `GET /index.html`

- `GET /assets/...`

  Serves static files.

- `POST /api/assembly`

  Body:
  `assembly name as a string UTF-8`

  Response:
  ```json
  {
      "id": "an UUID of the assembly",
      "secret": "the secret to pass into X-ASSEMBLY-SECRET header"
  }
  ```

- `GET /api/assembly/:id/state`

  Header `X-ASSEMBLY-SECRET`.

  Response:
  ```json
  {
      "members": [
          {
              "pk": "PUBLIC KEY DATA (PKCS)",
              "name": "John",
              "score": 0,
              "ready": false,
              "present": false
          }
      ],
      "questions": [
          "One question"
      ],
      "state_event": 10
  }
  ```

- `GET /api/assembly/:id/history`

  Header `X-ASSEMBLY-SECRET`.

  Response:
  ```json
  {
      "members": [
          {
              "pk": "PUBLIC KEY DATA (PKCS) - SHA-256",
              "name": "John"
          }
      ],
      "questions": [
          {
              "question": "A question",
              "estimations": [
                  {
                      "member_id": 0,
                      "estimation": 6
                  }
              ],
              "actual": 6
          }
      ]
  }
  ```

- `POST /api/assembly/:id/ws/:event_id`

  Header `X-ASSEMBLY-SECRET`.

  Request:
  ```json
  {
      "pk": "PUBLIC KEY DATA (PKCS)",
      "name": "name of the member"
  }
  ```

  Response:
  establishement of the WebSocket communication.
  ```