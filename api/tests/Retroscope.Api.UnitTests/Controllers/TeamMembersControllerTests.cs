using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Retroscope.Application.DTOs;
using Retroscope.Application.Interfaces;
using System.Net;
using FluentAssertions;

namespace Retroscope.Api.UnitTests.Controllers;

public class TeamMembersControllerTests
{
    [Fact]
    public async Task GetTeamMembers_WithValidAuth_ReturnsOkWithTeamMembers()
    {
        // Arrange
        var mockGateway = new Mock<ISupabaseGateway>();
        var teamId = "test-team-id";
        var expectedResponse = new TeamMembersResponse
        {
            Items = new List<TeamMemberItem>
            {
                new() { TeamId = teamId, UserId = "user1", DisplayName = "John Doe", Email = "john@example.com", Role = "admin" },
                new() { TeamId = teamId, UserId = "user2", DisplayName = "Jane Smith", Email = "jane@example.com", Role = "member" }
            }
        };
        
        mockGateway.Setup(x => x.GetTeamMembersAsync(It.IsAny<string>(), teamId, It.IsAny<CancellationToken>()))
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
        var response = await client.GetAsync($"/api/teams/{teamId}/members");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("John Doe");
        content.Should().Contain("Jane Smith");
        
        mockGateway.Verify(x => x.GetTeamMembersAsync("Bearer test-token", teamId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetTeamMembers_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var teamId = "test-team-id";
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
            });
        var client = factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/teams/{teamId}/members");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetTeamMembers_WithInvalidToken_ReturnsUnauthorized()
    {
        // Arrange
        var teamId = "test-team-id";
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
            });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer invalid-token");

        // Act
        var response = await client.GetAsync($"/api/teams/{teamId}/members");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
