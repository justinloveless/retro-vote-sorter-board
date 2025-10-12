using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("team_members", Schema = "public")]
public class TeamMember
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("team_id")]
    public Guid TeamId { get; set; }

    [Required]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [Required]
    [Column("role")]
    public string Role { get; set; } = string.Empty;

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    [ForeignKey("TeamId")]
    public Team? Team { get; set; }

    [ForeignKey("UserId")]
    public Profile? Profile { get; set; }
}

