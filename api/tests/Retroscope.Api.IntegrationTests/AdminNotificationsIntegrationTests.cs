using FluentAssertions;
using System.Net;
using System.Text.Json;

namespace Retroscope.Api.IntegrationTests;

public class AdminNotificationsIntegrationTests : IntegrationTestBase
{
    private const string ValidToken = "Bearer valid-admin-token";
    private const string InvalidToken = "Bearer invalid-token";
    private const string UserToken = "Bearer regular-user-token";

    [Fact]
    public async Task SendNotification_WithValidAuthAndPayload_ReturnsAccepted()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Important Update",
            body = "Please check the latest updates",
            targetUserIds = new[] { "user-1", "user-2" }
        };

        var expectedResponse = new { status = "queued" };

        SetupFunctionsStub("/admin-send-notification", HttpStatusCode.Accepted, expectedResponse, ValidToken);

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        
        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<JsonElement>(content);
        
        result.GetProperty("status").GetString().Should().Be("queued");

        // Verify the request was made to Functions with correct headers
        VerifyFunctionsRequest("/admin-send-notification", ValidToken);
    }

    [Fact]
    public async Task SendNotification_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SendNotification_WithInvalidToken_ReturnsUnauthorized()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, InvalidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SendNotification_WithInvalidPayload_ReturnsBadRequest()
    {
        // Arrange
        var requestPayload = new
        {
            title = "", // Invalid: empty title
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        
        var content = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<JsonElement>(content);
        error.GetProperty("error").GetString().Should().Be("Title and Body are required");
    }

    [Fact]
    public async Task SendNotification_WithNullPayload_ReturnsBadRequest()
    {
        // Act
        var response = await PostAsync("/api/admin/notifications", new { }, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        
        var content = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<JsonElement>(content);
        error.GetProperty("error").GetString().Should().Be("Title and Body are required");
    }

    [Fact]
    public async Task SendNotification_FunctionsReturns500_MapsToBadGateway()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        SetupFunctionsStub("/admin-send-notification", HttpStatusCode.InternalServerError, null, ValidToken);

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadGateway);
        
        var content = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<JsonElement>(content);
        error.GetProperty("error").GetString().Should().Be("Downstream service error");
    }

    [Fact]
    public async Task SendNotification_FunctionsReturns401_MapsToUnauthorized()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        SetupFunctionsStub("/admin-send-notification", HttpStatusCode.Unauthorized, null, ValidToken);

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SendNotification_FunctionsReturns403_MapsToForbidden()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        SetupFunctionsStub("/admin-send-notification", HttpStatusCode.Forbidden, null, ValidToken);

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SendNotification_PropagatesCorrelationId()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new[] { "user-1" }
        };

        var expectedResponse = new { status = "queued" };

        SetupFunctionsStub("/admin-send-notification", HttpStatusCode.Accepted, expectedResponse, ValidToken);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/admin/notifications");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", ValidToken);
        request.Headers.Add("X-Correlation-Id", "test-correlation-id");
        
        var json = JsonSerializer.Serialize(requestPayload);
        request.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        response.Headers.Should().ContainKey("X-Correlation-Id");
        response.Headers.GetValues("X-Correlation-Id").First().Should().Be("test-correlation-id");
    }

    [Fact]
    public async Task SendNotification_WithEmptyTargetUserIds_ReturnsBadRequest()
    {
        // Arrange
        var requestPayload = new
        {
            title = "Test",
            body = "Test body",
            targetUserIds = new string[0] // Invalid: empty array
        };

        // Act
        var response = await PostAsync("/api/admin/notifications", requestPayload, ValidToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        
        var content = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<JsonElement>(content);
        error.GetProperty("error").GetString().Should().Be("At least one target user ID is required");
    }
}
