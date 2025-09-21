using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;

namespace Retroscope.Api.UnitTests.Controllers;

public class AdminNotificationsControllerTests
{
    [Fact]
    public async Task SendNotification_WithValidAuthAndPayload_ReturnsAccepted()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var request = new AdminSendNotificationRequest
        {
            Title = "Test Notification",
            Body = "This is a test notification",
            TargetUserIds = new List<string> { "user1", "user2" }
        };
        var expectedResponse = new AdminSendNotificationResponse { Status = "queued" };
        
        mockGateway.Setup(x => x.AdminSendNotificationAsync(It.IsAny<string>(), It.IsAny<AdminSendNotificationRequest>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(expectedResponse);

        var factory = new TestApiFactory()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton(mockGateway.Object);
                });
            });

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer admin-token");
        
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/api/admin/notifications", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().Contain("queued");
        
        mockGateway.Verify(x => x.AdminSendNotificationAsync("Bearer admin-token", It.IsAny<AdminSendNotificationRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendNotification_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var request = new AdminSendNotificationRequest
        {
            Title = "Test Notification",
            Body = "This is a test notification",
            TargetUserIds = new List<string> { "user1" }
        };
        
        var factory = new TestApiFactory();
        var client = factory.CreateClient();
        
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/api/admin/notifications", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SendNotification_WithInvalidToken_ReturnsUnauthorized()
    {
        // Arrange
        var request = new AdminSendNotificationRequest
        {
            Title = "Test Notification",
            Body = "This is a test notification",
            TargetUserIds = new List<string> { "user1" }
        };
        
        var factory = new TestApiFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer invalid-token");
        
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/api/admin/notifications", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SendNotification_WithInvalidPayload_ReturnsBadRequest()
    {
        // Arrange
        var factory = new TestApiFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer admin-token");
        
        var invalidJson = "{ \"invalid\": \"payload\" }";
        var content = new StringContent(invalidJson, Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/api/admin/notifications", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
