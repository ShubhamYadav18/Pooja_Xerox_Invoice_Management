"use client";

export function ProfileSelect({
  name,
  defaultValue,
  profiles,
  className
}: {
  name: string;
  defaultValue: string;
  profiles: { id: string; name: string }[];
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        if (form) form.requestSubmit();
      }}
      className={className}
    >
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name}
        </option>
      ))}
    </select>
  );
}
