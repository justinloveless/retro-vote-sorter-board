using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Retroscope.Api.Controllers;
using Retroscope.Application.DTOs.RetroComments;
using Retroscope.Application.Interfaces;
using Xunit;

namespace Retroscope.Api.UnitTests.Controllers;

public sealed class RetroCommentsControllerTests
{
    private readonly Mock<ISupabaseGateway> _mockSupabaseGateway;
    private readonly RetroCommentsController _controller;

    public RetroCommentsControllerTests()
    {
        _mockSupabaseGateway = new Mock<ISupabaseGateway>();
        _controller = new RetroCommentsController(_mockSupabaseGateway.Object);

        // Setup HttpContext for authentication
        var httpContext = new DefaultHttpContext();
        httpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(
                new[] { new System.Security.Claims.Claim("sub", "test-user-id") },
                "test"
            )
        );
        httpContext.Request.Headers.Authorization = "Bearer test-token";
        _controller.ControllerContext = new ControllerContext()
        {
            HttpContext = httpContext
        };
    }

    [Fact]
    public async Task GetCommentsByItemIds_ReturnsOkWithComments()
    {
        // Arrange
        var itemIds = new List<string> { "item-1", "item-2" };
        var expectedComments = new List<RetroCommentItem>
        {
            new() { Id = "comment-1", ItemId = "item-1", Text = "Test comment", Author = "User 1" }
        };
        _mockSupabaseGateway.Setup(g => g.GetRetroCommentsByItemIdsAsync(itemIds, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedComments);

        // Act
        var result = await _controller.GetCommentsByItemIds(itemIds, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<RetroCommentsResponse>().Subject;
        response.Items.Should().BeEquivalentTo(expectedComments);
    }

    [Fact]
    public async Task GetCommentsByItemId_ReturnsOkWithComments()
    {
        // Arrange
        var itemId = "item-1";
        var expectedComments = new List<RetroCommentItem>
        {
            new() { Id = "comment-1", ItemId = itemId, Text = "Test comment", Author = "User 1" }
        };
        _mockSupabaseGateway.Setup(g => g.GetRetroCommentsByItemIdAsync(itemId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedComments);

        // Act
        var result = await _controller.GetCommentsByItemId(itemId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<RetroCommentsResponse>().Subject;
        response.Items.Should().BeEquivalentTo(expectedComments);
    }

    [Fact]
    public async Task CreateComment_ReturnsCreated()
    {
        // Arrange
        var request = new CreateRetroCommentRequest
        {
            ItemId = "item-1",
            Text = "New comment",
            Author = "User 1",
            AuthorId = "user-id-1"
        };
        var expectedComment = new RetroCommentItem
        {
            Id = "new-comment",
            ItemId = request.ItemId,
            Text = request.Text,
            Author = request.Author,
            AuthorId = request.AuthorId
        };
        _mockSupabaseGateway.Setup(g => g.CreateRetroCommentAsync(request, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedComment);

        // Act
        var result = await _controller.CreateComment(request, CancellationToken.None);

        // Assert
        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be(nameof(RetroCommentsController.GetCommentsByItemId));
        createdResult.RouteValues!["itemId"].Should().Be(request.ItemId);
        createdResult.Value.Should().BeEquivalentTo(expectedComment);
    }

    [Fact]
    public async Task DeleteComment_ReturnsNoContent()
    {
        // Arrange
        var commentId = "comment-1";
        _mockSupabaseGateway.Setup(g => g.DeleteRetroCommentAsync(commentId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.DeleteComment(commentId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task GetCommentsByItemIds_WithEmptyList_ReturnsOkWithEmptyList()
    {
        // Arrange
        var itemIds = new List<string>();
        _mockSupabaseGateway.Setup(g => g.GetRetroCommentsByItemIdsAsync(itemIds, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RetroCommentItem>());

        // Act
        var result = await _controller.GetCommentsByItemIds(itemIds, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<RetroCommentsResponse>().Subject;
        response.Items.Should().BeEmpty();
    }
}

