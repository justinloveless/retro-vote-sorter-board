using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;
using System.Text;
using FluentAssertions;
using Retroscope.Application.DTOs.Notifications;

namespace Retroscope.Api.UnitTests.Controllers;

public class NotificationsControllerTests
{
    [Fact]
    public async Task GetNotifications_WithValidAuth_ReturnsOkWithNotifications()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var expectedResponse = new NotificationsResponse
        {
            Items = new List<NotificationItem>
            {
                new() { Id = "1", UserId = "test-user", CreatedAt = DateTime.UtcNow, Type = "info", Title = "Test", Message = "Test body", Url = "/notifications/1", IsRead = false }
            }
        };
        
        mockGateway.Setup(x => x.GetNotificationsAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
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
        client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act
        var response = await client.GetAsync("/api/notifications");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Test");
        
        mockGateway.Verify(x => x.GetNotificationsAsync("Bearer test-token", 50, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetNotifications_WithLimitQueryParam_ReturnsOkWithCorrectLimit()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var expectedResponse = new NotificationsResponse { Items = new List<NotificationItem>() };
        
        mockGateway.Setup(x => x.GetNotificationsAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
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
        client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        // Act
        var response = await client.GetAsync("/api/notifications?limit=25");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        mockGateway.Verify(x => x.GetNotificationsAsync("Bearer test-token", 25, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetNotifications_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var factory = new TestApiFactory();
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/notifications");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetNotifications_WithInvalidToken_ReturnsUnauthorized()
    {
        // Arrange
        var factory = new TestApiFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer invalid-token");

        // Act
        var response = await client.GetAsync("/api/notifications");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task MarkNotificationRead_WithValidAuth_ReturnsOk()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var expectedResponse = new MarkNotificationReadResponse
        {
            Success = true,
            Message = "Notification marked as read"
        };
        
        mockGateway.Setup(x => x.MarkNotificationReadAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<MarkNotificationReadRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
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
        client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        var requestBody = new { is_read = true };
        var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        // Act
        var response = await client.PatchAsync("/api/notifications/test-id", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().Contain("success");
        
        mockGateway.Verify(x => x.MarkNotificationReadAsync("Bearer test-token", "test-id", It.IsAny<MarkNotificationReadRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkNotificationRead_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var requestBody = new { is_read = true };
        var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        // Act
        var response = await client.PatchAsync("/api/notifications/test-id", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task MarkAllNotificationsRead_WithValidAuth_ReturnsOk()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var expectedResponse = new MarkAllNotificationsReadResponse
        {
            Success = true,
            UpdatedCount = 5,
            Message = "All notifications marked as read"
        };
        
        mockGateway.Setup(x => x.MarkAllNotificationsReadAsync(It.IsAny<string>(), It.IsAny<MarkAllNotificationsReadRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
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
        client.DefaultRequestHeaders.Add("Authorization", "Bearer test-token");

        var requestBody = new { is_read = true };
        var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/api/notifications/mark-all-read", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().Contain("updated_count");
        
        mockGateway.Verify(x => x.MarkAllNotificationsReadAsync("Bearer test-token", It.IsAny<MarkAllNotificationsReadRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAllNotificationsRead_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var requestBody = new { is_read = true };
        var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        // Act
        var response = await client.PostAsync("/api/notifications/mark-all-read", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
