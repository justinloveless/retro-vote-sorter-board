using FluentAssertions;
using System.Net;
using System.Text.Json;

namespace Retroscope.Api.IntegrationTests;

public class NotificationsIntegrationTests : IntegrationTestBase
{
    private const string ValidToken = "Bearer valid-user-token";
    private const string InvalidToken = "Bearer invalid-user-token";

    [Fact]
    public async Task GetNotifications_WithValidAuth_ReturnsOk()
    {
        // Arrange
        var expectedResponse = new[]
        {
            new
            {
                id = "notification-1",
                created_at = "2025-01-01T12:00:00Z",
                type = "info",
                title = "Test Notification",
                body = "This is a test notification",
                read = false
            }
        };

        SetupPostgrestStub("/notifications?select=*&order=created_at.desc&limit=50", 
            HttpStatusCode.OK, expectedResponse, ValidToken);

        // Act
        var response = await GetAsync("/api/notifications", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var content = await response.Content.ReadAsStringAsync();
        var notifications = JsonSerializer.Deserialize<JsonElement>(content);
        
        notifications.GetProperty("items").GetArrayLength().Should().Be(1);
        notifications.GetProperty("items")[0].GetProperty("id").GetString().Should().Be("notification-1");
        notifications.GetProperty("items")[0].GetProperty("title").GetString().Should().Be("Test Notification");

        // Verify the request was made to PostgREST with correct headers
        VerifyPostgrestRequest("/notifications?select=*&order=created_at.desc&limit=50", ValidToken);
    }

    [Fact]
    public async Task GetNotifications_WithCustomLimit_ReturnsOk()
    {
        // Arrange
        var expectedResponse = new[]
        {
            new { id = "notification-1", created_at = "2025-01-01T12:00:00Z", type = "info", title = "Test", body = "Test body", read = false },
            new { id = "notification-2", created_at = "2025-01-01T11:00:00Z", type = "warning", title = "Warning", body = "Warning body", read = true }
        };

        SetupPostgrestStub("/notifications?select=*&order=created_at.desc&limit=25", 
            HttpStatusCode.OK, expectedResponse, ValidToken);

        // Act
        var response = await GetAsync("/api/notifications?limit=25", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var content = await response.Content.ReadAsStringAsync();
        var notifications = JsonSerializer.Deserialize<JsonElement>(content);
        
        notifications.GetProperty("items").GetArrayLength().Should().Be(2);

        // Verify the request was made to PostgREST with correct limit
        VerifyPostgrestRequest("/notifications?select=*&order=created_at.desc&limit=25", ValidToken);
    }

    [Fact]
    public async Task GetNotifications_WithoutAuth_ReturnsUnauthorized()
    {
        // Act
        var response = await GetAsync("/api/notifications");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetNotifications_WithInvalidToken_ReturnsUnauthorized()
    {
        // Act
        var response = await GetAsync("/api/notifications", InvalidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetNotifications_PostgrestReturns500_MapsToBadGateway()
    {
        // Arrange
        SetupPostgrestStub("/notifications?select=*&order=created_at.desc&limit=50", 
            HttpStatusCode.InternalServerError, null, ValidToken);

        // Act
        var response = await GetAsync("/api/notifications", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadGateway);
        
        var content = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<JsonElement>(content);
        error.GetProperty("error").GetString().Should().Be("Downstream service error");
    }

    [Fact]
    public async Task GetNotifications_PostgrestReturns401_MapsToUnauthorized()
    {
        // Arrange
        SetupPostgrestStub("/notifications?select=*&order=created_at.desc&limit=50", 
            HttpStatusCode.Unauthorized, null, ValidToken);

        // Act
        var response = await GetAsync("/api/notifications", ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetNotifications_PropagatesCorrelationId()
    {
        // Arrange
        var expectedResponse = new[]
        {
            new { id = "notification-1", created_at = "2025-01-01T12:00:00Z", type = "info", title = "Test", body = "Test body", read = false }
        };

        SetupPostgrestStub("/notifications?select=*&order=created_at.desc&limit=50", 
            HttpStatusCode.OK, expectedResponse, ValidToken);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/notifications");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", ValidToken);
        request.Headers.Add("X-Correlation-Id", "test-correlation-id");
        
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.Should().ContainKey("X-Correlation-Id");
        response.Headers.GetValues("X-Correlation-Id").First().Should().Be("test-correlation-id");
    }
}
