# WireMock Mappings

This directory contains WireMock mapping files for integration tests.

## Usage

WireMock mappings define how the mock server should respond to HTTP requests during integration tests.

## File Structure

- `notifications.json` - Mock responses for notifications endpoint
- `team-members.json` - Mock responses for team members endpoint  
- `admin-notifications.json` - Mock responses for admin notifications endpoint

## Running with Docker Compose

To run integration tests with WireMock:

```bash
docker-compose --profile integration-test up wiremock
```

This will start WireMock on port 8080 with the mappings in this directory loaded.
