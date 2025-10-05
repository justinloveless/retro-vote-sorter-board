using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Retroscope.Api.Controllers;
using Retroscope.Application.DTOs.Profiles;
using Retroscope.Application.Interfaces;

namespace Retroscope.Api.UnitTests.Controllers;

public sealed class ProfilesControllerTests
{
    private readonly Mock<ISupabaseGateway> _mockGateway;
    private readonly ProfilesController _controller;

    public ProfilesControllerTests()
    {
        _mockGateway = new Mock<ISupabaseGateway>();
        _controller = new ProfilesController(_mockGateway.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        _controller.HttpContext.Request.Headers.Authorization = "Bearer test-token";
    }

    [Fact]
    public async Task GetProfile_WithValidUserId_ReturnsProfileResponse()
    {
        // Arrange
        var userId = "test-user-id";
        var expectedProfile = new ProfileItem
        {
            Id = userId,
            FullName = "Test User",
            AvatarUrl = "https://example.com/avatar.png",
            Role = "user",
            ThemePreference = "dark",
            BackgroundPreference = new { type = "gradient", colors = new[] { "#000", "#fff" } }
        };

        _mockGateway
            .Setup(g => g.GetProfileByIdAsync(userId, "Bearer test-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedProfile);

        // Act
        var result = await _controller.GetProfile(userId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        okResult.Value.Should().BeOfType<ProfileResponse>();
        var response = (ProfileResponse)okResult.Value!;
        response.Profile.Should().BeEquivalentTo(expectedProfile);
    }

    [Fact]
    public async Task GetProfile_WithMissingAuthHeader_ReturnsUnauthorized()
    {
        // Arrange
        _controller.HttpContext.Request.Headers.Remove("Authorization");

        // Act
        var result = await _controller.GetProfile("test-user-id", CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task GetProfile_WhenGatewayThrowsUnauthorizedException_ReturnsUnauthorized()
    {
        // Arrange
        var userId = "test-user-id";
        _mockGateway
            .Setup(g => g.GetProfileByIdAsync(userId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UnauthorizedAccessException("Invalid token"));

        // Act
        var result = await _controller.GetProfile(userId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task GetProfile_WhenGatewayThrowsHttpRequestException_ReturnsBadGateway()
    {
        // Arrange
        var userId = "test-user-id";
        _mockGateway
            .Setup(g => g.GetProfileByIdAsync(userId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Supabase error"));

        // Act
        var result = await _controller.GetProfile(userId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<ObjectResult>();
        var objectResult = (ObjectResult)result;
        objectResult.StatusCode.Should().Be(502);
    }

    [Fact]
    public async Task GetProfile_ForwardsAuthorizationHeader()
    {
        // Arrange
        var userId = "test-user-id";
        var authHeader = "Bearer my-specific-token";
        _controller.HttpContext.Request.Headers.Authorization = authHeader;

        var profileItem = new ProfileItem
        {
            Id = userId,
            FullName = "Test User",
            AvatarUrl = null,
            Role = "user",
            ThemePreference = null,
            BackgroundPreference = null
        };

        _mockGateway
            .Setup(g => g.GetProfileByIdAsync(userId, authHeader, It.IsAny<CancellationToken>()))
            .ReturnsAsync(profileItem);

        // Act
        await _controller.GetProfile(userId, CancellationToken.None);

        // Assert
        _mockGateway.Verify(
            g => g.GetProfileByIdAsync(userId, authHeader, It.IsAny<CancellationToken>()),
            Times.Once
        );
    }

    [Fact]
    public async Task GetProfilesByIds_WithValidIds_ReturnsProfilesResponse()
    {
        // Arrange
        var userIds = new List<string> { "user-1", "user-2" };
        var expectedProfiles = new List<ProfileItem>
        {
            new() { Id = "user-1", FullName = "User One", AvatarUrl = null, Role = "user", ThemePreference = null, BackgroundPreference = null },
            new() { Id = "user-2", FullName = "User Two", AvatarUrl = null, Role = "user", ThemePreference = null, BackgroundPreference = null }
        };

        _mockGateway
            .Setup(g => g.GetProfilesByIdsAsync(userIds, "Bearer test-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedProfiles);

        // Act
        var result = await _controller.GetProfilesByIds(userIds, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        okResult.Value.Should().BeOfType<ProfilesResponse>();
        var response = (ProfilesResponse)okResult.Value!;
        response.Items.Should().BeEquivalentTo(expectedProfiles);
    }

    [Fact]
    public async Task UpdateProfile_WithValidRequest_ReturnsUpdatedProfile()
    {
        // Arrange
        var userId = "test-user-id";
        var request = new UpdateProfileRequest
        {
            FullName = "Updated Name",
            ThemePreference = "light"
        };
        var expectedProfile = new ProfileItem
        {
            Id = userId,
            FullName = "Updated Name",
            AvatarUrl = "https://example.com/avatar.png",
            Role = "user",
            ThemePreference = "light",
            BackgroundPreference = null
        };

        _mockGateway
            .Setup(g => g.UpdateProfileAsync(userId, request, "Bearer test-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedProfile);

        // Act
        var result = await _controller.UpdateProfile(userId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var response = (ProfileResponse)okResult.Value!;
        response.Profile.Should().BeEquivalentTo(expectedProfile);
    }

    [Fact]
    public async Task UpsertProfile_WithValidRequest_ReturnsNoContent()
    {
        // Arrange
        var userId = "test-user-id";
        var request = new UpdateProfileRequest
        {
            ThemePreference = "dark"
        };

        _mockGateway
            .Setup(g => g.UpsertProfileAsync(userId, request, "Bearer test-token", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.UpsertProfile(userId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task UpdateProfile_WithMissingAuthHeader_ReturnsUnauthorized()
    {
        // Arrange
        _controller.HttpContext.Request.Headers.Remove("Authorization");
        var request = new UpdateProfileRequest { FullName = "Test" };

        // Act
        var result = await _controller.UpdateProfile("test-user-id", request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task UpsertProfile_WithMissingAuthHeader_ReturnsUnauthorized()
    {
        // Arrange
        _controller.HttpContext.Request.Headers.Remove("Authorization");
        var request = new UpdateProfileRequest { ThemePreference = "dark" };

        // Act
        var result = await _controller.UpsertProfile("test-user-id", request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }
}

