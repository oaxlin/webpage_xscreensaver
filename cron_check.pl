#!/usr/bin/env perl
use strict;
use warnings;

my $dir = '/dev/shm/wall';
opendir(my $dh, $dir) || die "Can't opendir $dir: $!";
my @files = grep { $_ !~ /^\./ } readdir($dh);
closedir $dh;

my $max_time = 0;
foreach my $file (@files) {
	my $t = (stat($dir.'/'.$file))[9];
	$max_time = $t if $t > $max_time;
} 
my $age = time() - $max_time;
if ($age > 1200) {
	my @pids = grep { $_ != $$ } split "\n", `ps -ef | grep phantomjs | grep 'ps -ef' --invert | grep grep --invert | awk '{print\$2}'`;
	if (scalar @pids) {
		print "Killing stale wallboard (@pids)\n";
		kill( 9, @pids); 
	}
}

__END__

=head1 NAME

cron_check.pl - Run via cron to verify the phantomjs isn't stuck

=head1 DESCRIPTION

Put into your crontab

 sudo vi /etc/crontab

Enter this line (modify as needed for your repo location)

 */10 *  * * *   root    /home/pi/webpage_xscreensaver/cron_check.pl

Restart the cron service
