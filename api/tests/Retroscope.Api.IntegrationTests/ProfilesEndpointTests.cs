using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Retroscope.Application.DTOs.Profiles;

namespace Retroscope.Api.IntegrationTests;

public sealed class ProfilesEndpointTests : IntegrationTestBase
{
    [Fact]
    public async Task GetProfile_WithValidAuth_ReturnsProfile()
    {
        // Arrange
        var userId = "user-123";
        var mockProfileResponse = new[]
        {
            new
            {
                id = userId,
                full_name = "Test User",
                avatar_url = "https://example.com/avatar.png",
                role = "user",
                theme_preference = "dark",
                background_preference = new { type = "gradient" }
            }
        };

        SetupPostgrestStub($"/profiles?id=eq.{userId}&select=id,full_name,avatar_url,role,theme_preference,background_preference",
            HttpStatusCode.OK, mockProfileResponse, "test-token");

        // Act
        var response = await GetAsync($"/api/profiles/{userId}", "test-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ProfileResponse>();
        result.Should().NotBeNull();
        result!.Profile.Id.Should().Be(userId);
        result.Profile.FullName.Should().Be("Test User");
        result.Profile.AvatarUrl.Should().Be("https://example.com/avatar.png");
        result.Profile.Role.Should().Be("user");
        result.Profile.ThemePreference.Should().Be("dark");
    }

    [Fact]
    public async Task GetProfile_WithoutAuth_ReturnsUnauthorized()
    {
        // Arrange
        var userId = "user-123";

        // Act
        var response = await GetAsync($"/api/profiles/{userId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetProfile_WhenNotFound_ReturnsError()
    {
        // Arrange
        var userId = "nonexistent-user";

        SetupPostgrestStub($"/profiles?id=eq.{userId}&select=id,full_name,avatar_url,role,theme_preference,background_preference",
            HttpStatusCode.OK, new object[] { }, "test-token"); // Empty array

        // Act
        var response = await GetAsync($"/api/profiles/{userId}", "test-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GetProfile_WhenSupabaseReturns403_ReturnsUnauthorized()
    {
        // Arrange
        var userId = "forbidden-user";

        SetupPostgrestStub($"/profiles?id=eq.{userId}&select=id,full_name,avatar_url,role,theme_preference,background_preference",
            HttpStatusCode.Forbidden, new { message = "Forbidden" }, "test-token");

        // Act
        var response = await GetAsync($"/api/profiles/{userId}", "test-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetProfile_WhenSupabaseReturns500_ReturnsBadGateway()
    {
        // Arrange
        var userId = "error-user";

        SetupPostgrestStub($"/profiles?id=eq.{userId}&select=id,full_name,avatar_url,role,theme_preference,background_preference",
            HttpStatusCode.InternalServerError, new { message = "Internal Server Error" }, "test-token");

        // Act
        var response = await GetAsync($"/api/profiles/{userId}", "test-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadGateway);
    }

    [Fact]
    public async Task GetProfile_WithNullableFields_ReturnsProfileCorrectly()
    {
        // Arrange
        var userId = "minimal-user";
        var mockProfileResponse = new[]
        {
            new
            {
                id = userId,
                full_name = (string?)null,
                avatar_url = (string?)null,
                role = (string?)null,
                theme_preference = (string?)null,
                background_preference = (object?)null
            }
        };

        SetupPostgrestStub($"/profiles?id=eq.{userId}&select=id,full_name,avatar_url,role,theme_preference,background_preference",
            HttpStatusCode.OK, mockProfileResponse, "test-token");

        // Act
        var response = await GetAsync($"/api/profiles/{userId}", "test-token");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ProfileResponse>();
        result.Should().NotBeNull();
        result!.Profile.Id.Should().Be(userId);
        result.Profile.FullName.Should().BeNull();
        result.Profile.AvatarUrl.Should().BeNull();
        result.Profile.Role.Should().BeNull();
    }
}

