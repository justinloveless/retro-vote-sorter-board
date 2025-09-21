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
                new() { Id = "1", CreatedAt = DateTime.UtcNow, Type = "info", Title = "Test", Body = "Test body", Read = false }
            }
        };
        
        mockGateway.Setup(x => x.GetNotificationsAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(expectedResponse);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
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
        
        mockGateway.Verify(x => x.GetNotificationsAsync("Bearer test-token", 50, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetNotifications_WithLimitQueryParam_ReturnsOkWithCorrectLimit()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var expectedResponse = new NotificationsResponse { Items = new List<NotificationItem>() };
        
        mockGateway.Setup(x => x.GetNotificationsAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                  .ReturnsAsync(expectedResponse);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
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
        mockGateway.Verify(x => x.GetNotificationsAsync("Bearer test-token", 25, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetNotifications_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
            });
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
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
            });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer invalid-token");

        // Act
        var response = await client.GetAsync("/api/notifications");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
