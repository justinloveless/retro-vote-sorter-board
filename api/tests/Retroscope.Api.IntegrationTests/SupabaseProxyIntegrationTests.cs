using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;

namespace Retroscope.Api.IntegrationTests;

/// <summary>
/// Integration tests for the SupabaseProxyController.
/// These tests verify that the proxy correctly forwards requests to Supabase and returns responses.
/// </summary>
public class SupabaseProxyIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task ProxyGet_ForwardsRequestAndReturnsResponse()
    {
        // Arrange: Setup WireMock to respond to a GET request
        var responseData = new[] { new { id = "item1", name = "Test Item" } };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/custom_table")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.OK)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(responseData)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a GET request through the proxy
        var response = await Client.GetAsync("/api/supabase/custom_table");

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("item1");
        body.Should().Contain("Test Item");
    }

    [Fact]
    public async Task ProxyPost_ForwardsRequestBodyAndHeaders()
    {
        // Arrange: Setup WireMock to respond to a POST request
        var responseData = new[] { new { id = "new-item", name = "Created Item" } };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.Created)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(responseData)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a POST request through the proxy
        var requestBody = new { name = "New Item", description = "Test description" };
        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json");

        var response = await Client.PostAsync("/api/supabase/items", content);

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("new-item");
        body.Should().Contain("Created Item");
    }

    [Fact]
    public async Task ProxyPatch_ForwardsRequestCorrectly()
    {
        // Arrange: Setup WireMock to respond to a PATCH request
        var responseData = new[] { new { id = "item-to-update", name = "Updated Item" } };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .UsingPatch())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.OK)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(responseData)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a PATCH request through the proxy
        var requestBody = new { name = "Updated Item" };
        var content = new StringContent(
            JsonSerializer.Serialize(requestBody),
            Encoding.UTF8,
            "application/json");

        var response = await Client.PatchAsync("/api/supabase/items?id=eq.item-to-update", content);

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("Updated Item");
    }

    [Fact]
    public async Task ProxyDelete_ForwardsRequestCorrectly()
    {
        // Arrange: Setup WireMock to respond to a DELETE request
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .UsingDelete())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.NoContent));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a DELETE request through the proxy
        var response = await Client.DeleteAsync("/api/supabase/items?id=eq.item-to-delete");

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Proxy_ForwardsQueryParameters()
    {
        // Arrange: Setup WireMock to respond with a specific path (WireMock matches path without query)
        var responseData = new[] { new { id = "filtered-item" } };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.OK)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(responseData)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a request with query parameters
        var response = await Client.GetAsync("/api/supabase/items?select=id,name&limit=10");

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("filtered-item");
        
        // Verify the query string was forwarded to WireMock
        var logEntry = WireMockServer.LogEntries.FirstOrDefault(e => e.RequestMessage.Path == "/postgrest/items");
        logEntry.Should().NotBeNull();
        logEntry!.RequestMessage.Query.Should().ContainKey("select");
        logEntry!.RequestMessage.Query.Should().ContainKey("limit");
    }

    [Fact]
    public async Task Proxy_ForwardsPreferHeader()
    {
        // Arrange: Setup WireMock to respond to a POST with Prefer header
        var responseData = new[] { new { id = "inserted-item", name = "Item with representation" } };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .WithHeader("Prefer", "return=representation")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.Created)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(responseData)));

        // Act: Make a POST request with Prefer header
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/supabase/items");
        request.Headers.Add("Authorization", "Bearer test-token");
        request.Headers.Add("Prefer", "return=representation");
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { name = "New Item" }),
            Encoding.UTF8,
            "application/json");

        var response = await Client.SendAsync(request);

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("inserted-item");
        body.Should().Contain("Item with representation");
    }

    [Fact]
    public async Task Proxy_ReturnsUnauthorized_WhenNoAuthHeader()
    {
        // Act: Make a request without authorization header
        var response = await Client.GetAsync("/api/supabase/items");

        // Assert: Verify the response is unauthorized
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Proxy_ForwardsSupabaseErrors()
    {
        // Arrange: Setup WireMock to return an error
        var errorResponse = new { message = "Foreign key constraint violation", code = "23503" };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.Conflict)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(errorResponse)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a POST request that will fail
        var content = new StringContent(
            JsonSerializer.Serialize(new { invalid_field = "value" }),
            Encoding.UTF8,
            "application/json");

        var response = await Client.PostAsync("/api/supabase/items", content);

        // Assert: Verify the error is forwarded
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("23503");
    }

    [Fact]
    public async Task Proxy_HandlesNestedPaths()
    {
        // Arrange: Setup WireMock to respond to a nested path
        var responseData = new[] { new { id = "nested-item" } };
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/rpc/custom_function")
                .UsingPost())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.OK)
                .WithHeader("Content-Type", "application/json")
                .WithBody(JsonSerializer.Serialize(responseData)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a request to a nested path (RPC function)
        var content = new StringContent(
            JsonSerializer.Serialize(new { param1 = "value1" }),
            Encoding.UTF8,
            "application/json");

        var response = await Client.PostAsync("/api/supabase/rpc/custom_function", content);

        // Assert: Verify the response
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("nested-item");
    }

    [Fact]
    public async Task Proxy_ForwardsContentRangeHeader()
    {
        // Arrange: Setup WireMock to respond with Content-Range header (for pagination)
        var responseData = new[] 
        { 
            new { id = "item1" },
            new { id = "item2" },
            new { id = "item3" }
        };
        
        WireMockServer
            .Given(Request.Create()
                .WithPath("/postgrest/items")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(HttpStatusCode.PartialContent)
                .WithHeader("Content-Type", "application/json")
                .WithHeader("Content-Range", "0-2/100")
                .WithBody(JsonSerializer.Serialize(responseData)));

        Client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act: Make a request with Range header (PostgREST style, not HTTP bytes range)
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/supabase/items");
        request.Headers.Add("Authorization", "Bearer test-token");
        // PostgREST uses the "Range" header, but with a different format than HTTP byte ranges
        request.Headers.TryAddWithoutValidation("Range", "0-2");

        var response = await Client.SendAsync(request);

        // Assert: Verify the Content-Range header is forwarded
        response.StatusCode.Should().Be(HttpStatusCode.PartialContent);
        
        // Verify the body contains the expected data
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("item1");
        body.Should().Contain("item2");
        body.Should().Contain("item3");
        
        // Verify Content-Range header was forwarded
        // Content-Range is a content header, not a response header
        response.Content.Headers.TryGetValues("Content-Range", out var contentRangeValues).Should().BeTrue();
        contentRangeValues.Should().Contain("0-2/100");
    }
}

