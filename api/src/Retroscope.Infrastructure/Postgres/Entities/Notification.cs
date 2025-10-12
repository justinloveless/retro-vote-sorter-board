using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("notifications", Schema = "public")]
public class Notification
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [Required]
    [Column("type")]
    public string Type { get; set; } = string.Empty;

    [Required]
    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Column("message")]
    public string? Message { get; set; }

    [Column("url")]
    public string? Url { get; set; }

    [Required]
    [Column("is_read")]
    public bool IsRead { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}

