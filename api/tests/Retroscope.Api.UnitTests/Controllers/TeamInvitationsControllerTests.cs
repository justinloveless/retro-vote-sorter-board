using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Retroscope.Api.Controllers;
using Retroscope.Application.DTOs.TeamInvitations;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.UnitTests.Controllers;

public sealed class TeamInvitationsControllerTests
{
    private readonly Mock<ISupabaseGateway> _mockGateway;
    private readonly TeamInvitationsController _controller;

    public TeamInvitationsControllerTests()
    {
        _mockGateway = new Mock<ISupabaseGateway>();
        _controller = new TeamInvitationsController(_mockGateway.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        _controller.HttpContext.Request.Headers.Authorization = "Bearer test-token";
        _controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(new[]
            {
                new System.Security.Claims.Claim("sub", "test-user-id")
            }, "test"));
    }

    [Fact]
    public async Task GetInvitations_WithValidAuth_ReturnsOk()
    {
        // Arrange
        var teamId = "team-123";
        var expectedInvitations = new List<TeamInvitationItem>
        {
            new TeamInvitationItem
            {
                Id = "inv-1",
                TeamId = teamId,
                Email = "test@example.com",
                InvitedBy = "user-1",
                Token = "token-123",
                Status = "pending",
                InviteType = "email",
                IsActive = true,
                ExpiresAt = "2025-12-31T23:59:59Z",
                CreatedAt = "2025-01-01T00:00:00Z"
            }
        };

        _mockGateway
            .Setup(g => g.GetTeamInvitationsAsync(teamId, null, null, "Bearer test-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedInvitations);

        // Act
        var result = await _controller.GetInvitations(teamId, null, null, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        okResult.Value.Should().BeOfType<TeamInvitationsResponse>();
        var response = (TeamInvitationsResponse)okResult.Value!;
        response.Items.Should().HaveCount(1);
        response.Items[0].Email.Should().Be("test@example.com");
    }

    [Fact]
    public async Task GetInvitations_WithMissingAuth_ReturnsUnauthorized()
    {
        // Arrange
        _controller.HttpContext.Request.Headers.Remove("Authorization");

        // Act
        var result = await _controller.GetInvitations("team-123", null, null, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task CreateInvitation_WithValidAuth_ReturnsCreated()
    {
        // Arrange
        var teamId = "team-123";
        var request = new CreateTeamInvitationRequest
        {
            Email = "newuser@example.com",
            InviteType = "email"
        };

        var createdInvitation = new TeamInvitationItem
        {
            Id = "inv-new",
            TeamId = teamId,
            Email = request.Email,
            InvitedBy = "test-user-id",
            Token = "new-token",
            Status = "pending",
            InviteType = request.InviteType,
            IsActive = true,
            ExpiresAt = "2025-12-31T23:59:59Z",
            CreatedAt = "2025-01-01T00:00:00Z"
        };

        _mockGateway
            .Setup(g => g.CreateTeamInvitationAsync(teamId, request, "test-user-id", "Bearer test-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(createdInvitation);

        // Act
        var result = await _controller.CreateInvitation(teamId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<CreatedAtActionResult>();
        var createdResult = (CreatedAtActionResult)result;
        createdResult.Value.Should().Be(createdInvitation);
    }

    [Fact]
    public async Task UpdateInvitation_WithValidAuth_ReturnsNoContent()
    {
        // Arrange
        var invitationId = "inv-123";
        var request = new UpdateTeamInvitationRequest { IsActive = false };

        _mockGateway
            .Setup(g => g.UpdateTeamInvitationAsync(invitationId, request, "Bearer test-token", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.UpdateInvitation(invitationId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteInvitation_WithValidAuth_ReturnsNoContent()
    {
        // Arrange
        var invitationId = "inv-123";

        _mockGateway
            .Setup(g => g.DeleteTeamInvitationAsync(invitationId, "Bearer test-token", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.DeleteInvitation(invitationId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }
}

