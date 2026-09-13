# Engineering Lab v2 Compatibility

Batch 1 is intentionally additive at the stream level for the two enhanced experiments.

## RADIA MLX90393

The established prefix remains:

`time_us,bx_uT,by_uT,bz_uT,bmag_uT`

v2 appends:

`bxy_uT,azimuth_rad,elevation_rad`

## Encoder kinematics

The established prefix remains:

`time_us,count,angle_rad,omega_rps,alpha_rps2`

v2 appends:

`revolutions,phase_rad`

Consumers that bind strictly to a complete header should update their schema. Consumers that intentionally accept a documented stable prefix can continue reading the established fields. Future compatibility tests should enforce this policy automatically.
