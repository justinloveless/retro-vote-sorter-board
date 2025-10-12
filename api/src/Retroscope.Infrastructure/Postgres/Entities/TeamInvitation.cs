using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("team_invitations", Schema = "public")]
public class TeamInvitation
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Required]
    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Column("role")]
    public string Role { get; set; } = string.Empty;

    [Column("token")]
    public string? Token { get; set; }

    [Required]
    [Column("status")]
    public string Status { get; set; } = string.Empty;

    [Required]
    [Column("created_by")]
    public Guid CreatedBy { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }

    [Column("accepted_at")]
    public DateTime? AcceptedAt { get; set; }

    // Navigation properties
    [ForeignKey("TeamId")]
    public Team? Team { get; set; }
}

