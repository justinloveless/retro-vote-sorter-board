using Microsoft.Extensions.DependencyInjection;
using Moq;
using Retroscope.Application.Interfaces;
using System.Net;
using FluentAssertions;
using Retroscope.Application.DTOs.TeamMembers;

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
            Items =
            [
                new TeamMemberItem
                {
                    TeamId = teamId, UserId = "user1", DisplayName = "John Doe", Email = "john@example.com",
                    Role = "admin"
                },
                new TeamMemberItem
                {
                    TeamId = teamId, UserId = "user2", DisplayName = "Jane Smith", Email = "jane@example.com",
                    Role = "member"
                }
            ]
        };
        
        mockGateway.Setup(x => x.GetTeamMembersAsync(It.IsAny<string>(), teamId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
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
        var response = await client.GetAsync($"/api/teams/{teamId}/members");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("John Doe");
        content.Should().Contain("Jane Smith");
        
        mockGateway.Verify(x => x.GetTeamMembersAsync("Bearer test-token", teamId, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetTeamMembers_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var teamId = "test-team-id";
        var factory = new TestApiFactory();
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
        var factory = new TestApiFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer invalid-token");

        // Act
        var response = await client.GetAsync($"/api/teams/{teamId}/members");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

public class TeamMembersControllerWriteTests
{
    [Fact]
    public async Task AddMember_ReturnsNoContent_OnSuccess()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        var teamId = "team-1";
        mockGateway.Setup(g => g.AddMemberAsync(It.IsAny<string>(), teamId, It.IsAny<AddMemberRequest>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

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

        var payload = new StringContent("{\"user_id\":\"user-x\",\"role\":\"member\"}", System.Text.Encoding.UTF8, "application/json");
        var resp = await client.PostAsync($"/api/teams/{teamId}/members", payload);
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task UpdateMemberRole_ReturnsNoContent_OnSuccess()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        var teamId = "team-1"; var userId = "user-x";
        mockGateway.Setup(g => g.UpdateMemberRoleAsync(It.IsAny<string>(), teamId, userId, It.IsAny<UpdateMemberRoleRequest>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

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

        var payload = new StringContent("{\"role\":\"admin\"}", System.Text.Encoding.UTF8, "application/json");
        var resp = await client.PatchAsync($"/api/teams/{teamId}/members/{userId}", payload);
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveMember_ReturnsNoContent_OnSuccess()
    {
        var mockGateway = new Mock<ISupabaseGateway>();
        var teamId = "team-1"; var userId = "user-x";
        mockGateway.Setup(g => g.RemoveMemberAsync(It.IsAny<string>(), teamId, userId, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

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

        var resp = await client.DeleteAsync($"/api/teams/{teamId}/members/{userId}");
        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
