using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Retroscope.Api.Controllers;
using Retroscope.Application.DTOs.RetroBoards;
using Retroscope.Application.Interfaces;
using System.Security.Claims;
using Retroscope.Application.DTOs.RetroBoardConfig;
using Xunit;

namespace Retroscope.Api.UnitTests.Controllers;

public sealed class RetroBoardsControllerTests
{
    private readonly Mock<ISupabaseGateway> _mockSupabaseGateway;
    private readonly RetroBoardsController _controller;

    public RetroBoardsControllerTests()
    {
        _mockSupabaseGateway = new Mock<ISupabaseGateway>();
        _controller = new RetroBoardsController(_mockSupabaseGateway.Object);

        // Setup HttpContext for authentication
        var httpContext = new DefaultHttpContext();
        httpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(
                new[] { new Claim("sub", "test-user-id") },
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
    public async Task GetRetroBoards_ReturnsOkWithBoards()
    {
        // Arrange
        var teamId = "team-1";
        var expectedBoards = new List<RetroBoardItem>
        {
            new() { Id = "board-1", RoomId = "ABC123", Title = "Sprint Retro", TeamId = teamId }
        };
        _mockSupabaseGateway.Setup(g => g.GetRetroBoardsAsync(teamId, false, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedBoards);

        // Act
        var result = await _controller.GetRetroBoards(teamId, false, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<RetroBoardsResponse>().Subject;
        response.Items.Should().BeEquivalentTo(expectedBoards);
    }

    [Fact]
    public async Task GetRetroBoardSummary_ReturnsOkWithSummary()
    {
        // Arrange
        var roomId = "ABC123";
        var expectedSummary = new RetroBoardSummaryResponse
        {
            Board = new() { Id = "board-1", RoomId = roomId, Title = "Sprint Retro" },
            Team = new() { Id = "team-1", Name = "Engineering" }
        };
        _mockSupabaseGateway.Setup(g => g.GetRetroBoardSummaryAsync(roomId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedSummary);

        // Act
        var result = await _controller.GetRetroBoardSummary(roomId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(expectedSummary);
    }

    [Fact]
    public async Task GetRetroBoardSummary_ReturnsNotFound_WhenBoardDoesNotExist()
    {
        // Arrange
        var roomId = "NONEXISTENT";
        _mockSupabaseGateway.Setup(g => g.GetRetroBoardSummaryAsync(roomId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((RetroBoardSummaryResponse?)null);

        // Act
        var result = await _controller.GetRetroBoardSummary(roomId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task GetRetroBoardTitlesByIds_ReturnsOkWithTitles()
    {
        // Arrange
        var boardIds = new List<string> { "board-1", "board-2" };
        var expectedTitles = new List<BoardTitleItem>
        {
            new() { Id = "board-1", Title = "Sprint 1 Retro" },
            new() { Id = "board-2", Title = "Sprint 2 Retro" }
        };
        _mockSupabaseGateway.Setup(g => g.GetRetroBoardTitlesByIdsAsync(boardIds, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedTitles);

        // Act
        var result = await _controller.GetRetroBoardTitlesByIds(boardIds, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<BoardTitlesResponse>().Subject;
        response.Items.Should().BeEquivalentTo(expectedTitles);
    }

    [Fact]
    public async Task CreateRetroBoard_ReturnsCreated()
    {
        // Arrange
        var request = new CreateRetroBoardRequest
        {
            RoomId = "ABC123",
            Title = "New Sprint Retro",
            IsPrivate = false,
            TeamId = "team-1"
        };
        var expectedBoard = new RetroBoardItem
        {
            Id = "new-board",
            RoomId = request.RoomId,
            Title = request.Title,
            IsPrivate = request.IsPrivate,
            TeamId = request.TeamId,
            CreatorId = "test-user-id"
        };
        _mockSupabaseGateway.Setup(g => g.CreateRetroBoardAsync(It.IsAny<CreateRetroBoardRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedBoard);

        // Act
        var result = await _controller.CreateRetroBoard(request, CancellationToken.None);

        // Assert
        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be(nameof(RetroBoardsController.GetRetroBoardSummary));
        createdResult.RouteValues!["roomId"].Should().Be(request.RoomId);
        createdResult.Value.Should().BeEquivalentTo(expectedBoard);
    }

    [Fact]
    public async Task UpdateRetroBoard_ReturnsNoContent()
    {
        // Arrange
        var boardId = "board-1";
        var request = new UpdateRetroBoardRequest
        {
            Title = "Updated Title",
            Archived = true
        };
        _mockSupabaseGateway.Setup(g => g.UpdateRetroBoardAsync(boardId, request, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.UpdateRetroBoard(boardId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task UpdateRetroBoard_ReturnsNotFound_WhenBoardDoesNotExist()
    {
        // Arrange
        var boardId = "nonexistent-board";
        var request = new UpdateRetroBoardRequest { Title = "Updated Title" };
        _mockSupabaseGateway.Setup(g => g.UpdateRetroBoardAsync(boardId, request, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        // Act
        var result = await _controller.UpdateRetroBoard(boardId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task DeleteRetroBoard_ReturnsNoContent()
    {
        // Arrange
        var boardId = "board-1";
        _mockSupabaseGateway.Setup(g => g.DeleteRetroBoardAsync(boardId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.DeleteRetroBoard(boardId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task DeleteRetroBoard_ReturnsNotFound_WhenBoardDoesNotExist()
    {
        // Arrange
        var boardId = "nonexistent-board";
        _mockSupabaseGateway.Setup(g => g.DeleteRetroBoardAsync(boardId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        // Act
        var result = await _controller.DeleteRetroBoard(boardId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task GetRetroBoards_ReturnsUnauthorized_WhenMissingAuthHeader()
    {
        // Arrange
        var controllerWithoutAuth = new RetroBoardsController(_mockSupabaseGateway.Object);
        var httpContext = new DefaultHttpContext();
        controllerWithoutAuth.ControllerContext = new ControllerContext()
        {
            HttpContext = httpContext
        };

        // Act
        var result = await controllerWithoutAuth.GetRetroBoards("team-1", false, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task CreateRetroBoard_SetsCreatorIdFromAuthenticatedUser()
    {
        // Arrange
        var request = new CreateRetroBoardRequest
        {
            RoomId = "ABC123",
            Title = "New Sprint Retro",
            TeamId = "team-1"
        };
        CreateRetroBoardRequest? capturedRequest = null;
        _mockSupabaseGateway.Setup(g => g.CreateRetroBoardAsync(It.IsAny<CreateRetroBoardRequest>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<CreateRetroBoardRequest, string, CancellationToken>((req, auth, ct) => capturedRequest = req)
            .ReturnsAsync(new RetroBoardItem { Id = "new-board", RoomId = request.RoomId });

        // Act
        await _controller.CreateRetroBoard(request, CancellationToken.None);

        // Assert
        capturedRequest.Should().NotBeNull();
        capturedRequest!.CreatorId.Should().Be("test-user-id");
    }

    [Fact]
    public async Task GetRetroBoardConfig_ReturnsOkWithConfig()
    {
        // Arrange
        var boardId = "board-1";
        var expectedConfig = new RetroBoardConfigItem
        {
            Id = "config-1",
            BoardId = boardId,
            AllowAnonymous = true,
            VotingEnabled = true,
            MaxVotesPerUser = 3,
            ShowAuthorNames = true,
            RetroStagesEnabled = false,
            EnforceStageReadiness = false,
            AllowSelfVotes = true,
            VoteEmoji = "👍"
        };
        _mockSupabaseGateway.Setup(g => g.GetRetroBoardConfigAsync(boardId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedConfig);

        // Act
        var result = await _controller.GetRetroBoardConfig(boardId, CancellationToken.None);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<RetroBoardConfigResponse>().Subject;
        response.Config.Should().BeEquivalentTo(expectedConfig);
    }

    [Fact]
    public async Task GetRetroBoardConfig_ReturnsNotFound_WhenConfigDoesNotExist()
    {
        // Arrange
        var boardId = "board-1";
        _mockSupabaseGateway.Setup(g => g.GetRetroBoardConfigAsync(boardId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((RetroBoardConfigItem?)null);

        // Act
        var result = await _controller.GetRetroBoardConfig(boardId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task CreateRetroBoardConfig_ReturnsCreated()
    {
        // Arrange
        var request = new CreateRetroBoardConfigRequest
        {
            BoardId = "board-1",
            AllowAnonymous = true,
            VotingEnabled = true,
            MaxVotesPerUser = 3
        };
        var expectedConfig = new RetroBoardConfigItem
        {
            Id = "new-config",
            BoardId = request.BoardId,
            AllowAnonymous = request.AllowAnonymous,
            VotingEnabled = request.VotingEnabled,
            MaxVotesPerUser = request.MaxVotesPerUser
        };
        _mockSupabaseGateway.Setup(g => g.CreateRetroBoardConfigAsync(request, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedConfig);

        // Act
        var result = await _controller.CreateRetroBoardConfig(request, CancellationToken.None);

        // Assert
        var createdResult = result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be(nameof(RetroBoardsController.GetRetroBoardConfig));
        createdResult.RouteValues!["boardId"].Should().Be(request.BoardId);
        createdResult.Value.Should().BeEquivalentTo(expectedConfig);
    }

    [Fact]
    public async Task UpdateRetroBoardConfig_ReturnsNoContent()
    {
        // Arrange
        var boardId = "board-1";
        var request = new UpdateRetroBoardConfigRequest
        {
            AllowAnonymous = false,
            VotingEnabled = false
        };
        _mockSupabaseGateway.Setup(g => g.UpdateRetroBoardConfigAsync(boardId, request, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.UpdateRetroBoardConfig(boardId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task UpdateRetroBoardConfig_ReturnsNotFound_WhenConfigDoesNotExist()
    {
        // Arrange
        var boardId = "nonexistent-board";
        var request = new UpdateRetroBoardConfigRequest { AllowAnonymous = true };
        _mockSupabaseGateway.Setup(g => g.UpdateRetroBoardConfigAsync(boardId, request, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        // Act
        var result = await _controller.UpdateRetroBoardConfig(boardId, request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task CreateRetroBoardConfig_WithMissingAuthHeader_ReturnsUnauthorized()
    {
        // Arrange
        var controllerWithoutAuth = new RetroBoardsController(_mockSupabaseGateway.Object);
        var httpContext = new DefaultHttpContext();
        controllerWithoutAuth.ControllerContext = new ControllerContext()
        {
            HttpContext = httpContext
        };

        var request = new CreateRetroBoardConfigRequest { BoardId = "board-1" };

        // Act
        var result = await controllerWithoutAuth.CreateRetroBoardConfig(request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task UpdateRetroBoardConfig_WithMissingAuthHeader_ReturnsUnauthorized()
    {
        // Arrange
        var controllerWithoutAuth = new RetroBoardsController(_mockSupabaseGateway.Object);
        var httpContext = new DefaultHttpContext();
        controllerWithoutAuth.ControllerContext = new ControllerContext()
        {
            HttpContext = httpContext
        };

        var request = new UpdateRetroBoardConfigRequest { AllowAnonymous = true };

        // Act
        var result = await controllerWithoutAuth.UpdateRetroBoardConfig("board-1", request, CancellationToken.None);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }
}

